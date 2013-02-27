var Table = module.exports = function() {

}

Table.prototype.processSpotUser = function(spot, current) {
    if (current.spots.length < current.rules.spots) {
        return
    }

    current.state = 'playing'

    return current
}
