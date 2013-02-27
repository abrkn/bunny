var expect = require('expect.js')
, Table = require('../lib/Table')

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
        })
    })
})
