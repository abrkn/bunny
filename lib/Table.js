var Table = module.exports = function() {

}

Table.prototype.processSpotUser = function(spot, current) {
    var active = current.spots.filter(function(s) {
        return s.user
    })

    if (active.length < current.rules.spots) {
        return
    }

    current.state = 'playing'

    return current
}
