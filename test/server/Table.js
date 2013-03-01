var expect = require('expect.js')
, Table = require('../../lib/server/Table')

describe('Table', function() {
    describe('processSpotUser', function() {
        it('does not start game until full', function() {
            var table = new Table()
            , current = {
                rules: { spots: 2 },
                spots: [{ user: "2" }]
            }
            , result = table.processSpotUser(0, current)
            expect(result).to.be(undefined)
        })

        it('starts play timer when full', function() {
            var table = new Table()
            , current = {
                state: 'dead',
                rules: { spots: 2 },
                spots: [{ user: "2" }, { user: "3" }]
            }
            , result = table.processSpotUser(0, current)
            expect(result).to.be.ok()
            expect(table.startPlayingTimer).to.be.ok()
            clearTimeout(table.startPlayingTimer)
        })
    })

    describe('processPlayingState', function() {
        it('does nothing if cards are already dealt', function() {
            var table = new Table()
            , current = {
                state: 'playing',
                deck: []
            }
            , result = table.processPlayingState(current)
            expect(result).to.be(undefined)
        })

        it('starts play timer if the deck has is not set', function() {
            var table = new Table()
            , current = {
                state: 'playing',
                spots: [{}, {}],
                hash: 'abc',
                hush: '123'
            }
            , result = table.processPlayingState(current)
            expect(result).to.be.ok()
            clearTimeout(table.startPlayingTimer)
        })

        it('deals cards if the deck is not set', function() {
            var table = new Table()
            , current = {
                state: 'playing',
                spots: [{}, {}],
                hash: 'abc',
                hush: '123'
            }
            , result = table.processPlayingState(current)
            expect(table.turnTimer).to.be.ok()
            clearTimeout(table.turnTimer)
        })
    })

    describe('processSpotPendingCommitted', function() {
        it('refuses too few commmitted', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [1, 2, 3, 4, 5],
                    pending_committed: [
                        { hand: 0, card: 1 },
                        { hand: 0, card: 2 },
                        { hand: 0, card: 3 },
                        { hand: 0, card: 4 }
                    ]
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            , spot = current.spots[0]
            expect(spot.pending_committed).to.be(null)
            expect(spot.committed).to.not.be.ok()
        })

        it('refuses too many commmitted', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [1, 2, 3, 4, 5],
                    pending_committed: [
                        { hand: 0, card: 1 },
                        { hand: 0, card: 2 },
                        { hand: 0, card: 3 },
                        { hand: 0, card: 4 },
                        { hand: 0, card: 5 },
                        { hand: 0, card: 6 }
                    ]
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            , spot = current.spots[0]
            expect(spot.pending_committed).to.be(null)
            expect(spot.committed).to.not.be.ok()
        })

        it('refuses undealt card commmitted', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [1, 2, 3, 4, 6],
                    pending_committed: [
                        { hand: 0, card: 1 },
                        { hand: 0, card: 2 },
                        { hand: 0, card: 3 },
                        { hand: 0, card: 4 },
                        { hand: 0, card: 5 }
                    ]
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            , spot = current.spots[0]
            expect(spot.pending_committed).to.be(null)
            expect(spot.committed).to.not.be.ok()
        })

        it('refuses over filling back hand', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [6],
                    hands: [
                        [1, 2, 3, 4, 5]
                    ],
                    pending_committed: [
                        { hand: 0, card: 6 }
                    ]
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            , spot = current.spots[0]
            expect(spot.pending_committed).to.be(null)
            expect(spot.committed).to.not.be.ok()
        })

        it('accepts correct commit initial deal', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [1, 2, 3, 4, 5],
                    pending_committed: [
                        { hand: 0, card: 1 },
                        { hand: 0, card: 2 },
                        { hand: 0, card: 3 },
                        { hand: 0, card: 4 },
                        { hand: 0, card: 5 }
                    ]
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            , spot = current.spots[0]
            expect(spot.pending_committed).to.be(null)
            expect(spot.committed).to.be.ok()
        })

        it('aborts when pending_committed is null (concurrency)', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [1, 2, 3, 4, 5],
                    pending_committed: null
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            expect(result).to.be(undefined)
        })

        it('adds to existing hand', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [6],
                    hands: [
                        [1, 2, 3, 4, 5],
                        []
                    ],
                    pending_committed: [
                        { hand: 1, card: 6 }
                    ]
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            , spot = current.spots[0]
            expect(spot.pending_committed).to.be(null)
            expect(spot.committed).to.be.ok()
        })
    })

    describe('processSpotCommitted', function() {
        it('does nothing when some spots are uncommitted', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [],
                    committed: []
                }, {
                    dealt: []
                }]
            }
            , result = table.processSpotCommitted(0, current)
            expect(result).to.be(undefined)
        })

        it('places cards in new hands', function() {
            var table = new Table()
            , current = {
                spots: [{
                    committed: [
                        { card: 15, hand: 0 },
                        { card: 20, hand: 1 }
                    ]
                }]
            }
            , result = table.processSpotCommitted(0, current)
            expect(result.spots[0].committed).to.be(null)
            expect(result.spots[0].hands[0][0]).to.be(15)
            expect(result.spots[0].hands[1][0]).to.be(20)
        })

        it('places cards in new hands', function() {
            var table = new Table()
            , current = {
                spots: [{
                    committed: [
                        { card: 15, hand: 0 },
                        { card: 20, hand: 1 }
                    ]
                }]
            }
            table.turnTimer = 1
            table.processSpotCommitted(0, current)
            expect(table.turnTimer).to.not.be.ok()
        })

        it('places cards in existing hands', function() {
            var table = new Table()
            , current = {
                spots: [{
                    committed: [
                        { card: 15, hand: 0 },
                        { card: 20, hand: 1 }
                    ],
                    hands: [[1, 2]]
                }]
            }
            , result = table.processSpotCommitted(0, current)
            expect(result.spots[0].committed).to.be(null)
            expect(result.spots[0].hands[0][2]).to.be(15)
        })
    })

    describe('processSpotHands', function() {
        it('passes turn unless showdown', function() {
            var table = new Table()
            , current = {
                turn: 0,
                spots: [{}, {}]
            }
            , result = table.processSpotHands(0, current)
            expect(result.turn).to.be(1)
        })

        it('enters finished state on showdown', function() {
            var table = new Table()
            , current = {
                spots: [{
                    hands: [
                        [1, 2, 3, 4, 5],
                        [6, 7, 8, 9, 10],
                        [11, 12, 13]
                    ]
                }]
            }
            , result = table.processSpotHands(0, current)
            expect(result.state).to.be('finished')
        })

        it('aborts if state is finished', function() {
            var table = new Table()
            , current = {
                state: 'finished',
                spots: [{
                    hands: [
                        [1, 2, 3, 4, 5],
                        [6, 7, 8, 9, 10],
                        [11, 12, 13]
                    ]
                }]
            }
            , result = table.processSpotHands(0, current)
            expect(result).to.be(undefined)
        })
    })

    describe('processTurnTimeout', function() {
        it('aborts if turn timer is null', function() {
            var table = new Table()
            , result = table.processTurnTimeout()
            expect(result).to.be(undefined)
        })

        it('makes a pending_committed', function() {
            var table = new Table()
            , current = {
                spots: [{
                    dealt: [1, 2, 3, 4, 5, 6]
                }]
            }
            table.turnTimer = 1
            var result = table.processTurnTimeout(current)
            expect(result.spots[0].pending_committed).to.eql([
                { hand: 0, card: 1 },
                { hand: 0, card: 2 },
                { hand: 0, card: 3 },
                { hand: 0, card: 4 },
                { hand: 0, card: 5 },
                { hand: 1, card: 6 }
            ])
        })

        it('removes the timer reference', function() {
            var table = new Table()
            , current = {
                spots: []
            }
            table.turnTimer = 1
            table.processTurnTimeout(current)
            expect(current.turnTimer).to.not.be.ok()
        })
    })

    describe('processTurn', function() {
        it('starts the turn timer', function() {
            var table = new Table()
            , current = {
                deck: [1],
                turn: 0,
                spots: [{
                }]
            }
            var result = table.processTurn(current)
            expect(result).to.be.ok()
            expect(table.turnTimer).to.be.ok()
            clearTimeout(table.turnTimer)
        })
    })
})
