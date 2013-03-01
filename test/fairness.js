var expect = require('expect.js')
, fairness = require('../lib/fairness')

describe('fairness', function() {
    describe('shuffle', function() {
        it('is predictable with no inputs', function() {
            var deck1 = fairness.shuffle([])
            , deck2 = fairness.shuffle([])
            expect(deck1).to.eql(deck2)
        })

        it('is predictable with no inputs', function(done) {
            var deck1 = fairness.shuffle([])

            setTimeout(function() {
                var deck2 = fairness.shuffle([])
                expect(deck1).to.eql(deck2)
                done()
            }, 10)
        })

        it('is predictable with several inputs', function() {
            var deck1 = fairness.shuffle(['derp', 'herp'])
            , deck2 = fairness.shuffle(['derp', 'herp'])
            expect(deck1).to.eql(deck2)
        })

        it('is varies with inputs', function() {
            var deck1 = fairness.shuffle(['derp', 'herp'])
            , deck2 = fairness.shuffle(['derp', 'lerp'])
            expect(deck1).to.not.eql(deck2)
        })
    })
})
