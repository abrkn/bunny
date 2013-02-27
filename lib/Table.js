var _ = require('underscore')
, Table = module.exports = function() {

}

Table.prototype.processSpotUser = function(spot, current) {
    if (current.spots.length < current.rules.spots) return

    current.state = 'playing'

    return current
}

Table.prototype.processPlayingState = function(current) {
    if (current.deck) return

    // shuffle cards
    current.deck = _.range(1, 53).sort(function() {
        return Math.random()
    })

    // five cards for each spot
    current.spots.forEach(function(s) {
        s.dealt = current.deck.splice(0, 5)
    })

    return current
}

Table.prototype.processSpotPendingCommitted = function(spotIndex, current) {
    var spot = current.spots[spotIndex]
    spot.committed = spot.pending_committed
    spot.pending_committed = null
    return current
}
