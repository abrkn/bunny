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

        it('starts game when full', function() {
            var table = new Table()
            , current = {
                state: 'dead',
                rules: { spots: 2 },
                spots: [{ user: "2" }, { user: "3" }]
            }
            , result = table.processSpotUser(0, current)
            expect(result.state).to.be('playing')
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

        it('deals cards if the deck has is not set', function() {
            var table = new Table()
            , current = {
                state: 'playing',
                spots: [{}, {}]
            }
            , result = table.processPlayingState(current)
            expect(result.deck.length).to.be(52 - 5 * 2)
            expect(result.spots[0].dealt.length).to.be(5)
            expect(result.spots[1].dealt.length).to.be(5)
            expect(result.game).to.be(1)
            expect(result.button).to.be.a('number')
        })
    })

    describe('processSpotPendingCommitted', function() {
        it('commits', function() {
            var table = new Table()
            , current = {
                spots: [{
                    pending_committed: [
                        { hand: 0, card: 12 },
                        { hand: 1, card: 28 }
                    ]
                }]
            }
            , result = table.processSpotPendingCommitted(0, current)
            expect(result.spots[0].committed[0].hand).to.be(0)
            expect(result.spots[0].committed[1].card).to.be(28)
            expect(result.spots[0].pending_committed).to.not.be.ok()
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
    })
})
