var crypto = require('crypto')
, chancejs = require('chancejs')
, _ = require('underscore')

function hashString(s) {
    var hash = 0
    for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i)
        hash = ((hash << 5) - hash) + c
        hash = hash & hash
    }
    return hash
}

module.exports = {
    random: function() {
        var seed = crypto.randomBytes(20);
        return crypto.createHash('sha1').update(seed).digest('hex');
    },

    shuffle: function(inputs) {
        var hash = crypto.createHash('sha1')

        inputs.forEach(hash.update, hash)
        hash = hash.digest('hex')
        hash = hashString(hash)

        var seed = new chancejs.MersenneTwister(hash)
        , random = new chancejs.Random(seed)
        , deck = _.sortBy(_.range(1, 53), function() { return random.get() })

        return deck
    }
}
