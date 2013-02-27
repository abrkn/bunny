var _ = require('underscore')
, util = require('util')
, debug = require('debug')('bunny')

var Table = module.exports = function(ref) {
    if (!(this.ref = ref)) return

    debug('waiting for rules')
    ref.on('value', this.onValue.bind(this))
}

Table.prototype.onValue = function(snapshot) {
    if (this.rules) return

    this.rules = snapshot.val().rules

    for (var i = 0; i < this.rules.spots; i++) {
        var spotRef = this.ref.child('spots/' + i)
        spotRef.child('user').on('value', this.onSpotUser.bind(this, i))
        spotRef.child('pending_committed').on('value', this.onSpotPendingCommitted.bind(this, i))
        spotRef.child('committed').on('value', this.onSpotCommitted.bind(this, i))
        spotRef.child('hands').on('value', this.onSpotHands.bind(this, i))
    }

    this.ref.child('state').on('value', this.onState.bind(this))
    this.ref.child('turn').on('value', this.onTurn.bind(this))
}

Table.prototype.onState = function(snapshot) {
    process.nextTick(function() {
        if (snapshot.val() == 'playing') {
            this.ref.transaction(
                this.processPlayingState.bind(this))
        } else if (snapshot.val() == 'finished') {
            this.ref.transaction(
                this.processFinishedState.bind(this))
        }
    }.bind(this))
}

Table.prototype.onTurn = function(snapshot) {
    if (!_.isNumber(snapshot.val())) return

    process.nextTick(function() {
        this.ref.transaction(
            this.processTurn.bind(this))
    }.bind(this))
}

Table.prototype.processTurn = function(current) {
    if (current.spots[current.turn].dealt) {
        debug('ignoring turn, spot has already been dealt')
        return
    }

    debug('dealing to spot on turn %s', current.turn)

    current.spots[current.turn].dealt = current.deck.splice(0, 1)

    return current
}

Table.prototype.onSpotUser = function(index, snapshot) {
    if (!snapshot.val()) return

    process.nextTick(function() {
        this.ref.transaction(
            this.processSpotUser.bind(this, index))
    }.bind(this))
}

Table.prototype.onSpotHands = function(index, snapshot) {
    if (!snapshot.val()) return

    process.nextTick(function() {
        this.ref.transaction(
            this.processSpotHands.bind(this, index))
    }.bind(this))
}

Table.prototype.onSpotCommitted = function(index, snapshot) {
    if (!snapshot.val()) return

    process.nextTick(function() {
        this.ref.transaction(
            this.processSpotCommitted.bind(this, index))
    }.bind(this))
}

Table.prototype.onSpotPendingCommitted = function(index, snapshot) {
    if (!snapshot.val()) return

    process.nextTick(function() {
        this.ref.transaction(
            this.processSpotPendingCommitted.bind(this, index))
    }.bind(this))
}

Table.prototype.processSpotUser = function(spot, current) {
    if (current.state != 'dead') {
        debug('ignoring spot user change on non-dead game')
        return
    }

    if (current.spots.length < current.rules.spots) {
        debug('waiting for %s players',
            current.rules.spots - current.spots.length)
        return
    }

    debug('enough players seated, setting state to playing')

    current.state = 'playing'

    return current
}

Table.prototype.processPlayingState = function(current) {
    if (current.deck) return

    debug('shuffling and dealing')

    // shuffle cards
    current.deck = _.range(1, 53).sort(function() {
        return Math.random()
    })

    // five cards for each spot
    current.spots.forEach(function(s) {
        s.dealt = current.deck.splice(0, 5)
    })

    current.game = (current.game || 0) + 1

    if (!_.isNumber(current.button)) {
        current.button = Math.floor(Math.random() * current.spots.length)
        debug('assigning button randomly to %s', current.button)
    } else {
        current.button++
    }

    return current
}

Table.prototype.processSpotPendingCommitted = function(spotIndex, current) {
    var spot = current.spots[spotIndex]
    spot.committed = spot.pending_committed
    spot.pending_committed = null
    spot.dealt = null
    return current
}

Table.prototype.processSpotCommitted = function(spotIndex, current) {
    if (current.spots.some(function(s) {
        return s.dealt && !s.committed
    })) {
        return
    }

    // place committed cards in hands
    current.spots.forEach(function(s) {
        if (!s.committed) return
        s.hands || (s.hands = [])
        s.committed.forEach(function(c) {
            s.hands[c.hand] || (s.hands[c.hand] = [])
            s.hands[c.hand].push(c.card)
        })
        s.committed = null
    })

    return current
}

Table.prototype.processSpotHands = function(spotIndex, current) {
    var finished = current.spots.every(function(s) {
        return s.hands &&
        s.hands[0] &&
        s.hands[1] &&
        s.hands[2] &&
        s.hands.every(function(h, i) {
            return h.length === (i === 2 ? 3 : 5)
        })
    })

    if (!finished) {
        debug('passing turn')

        // advance turn if it exists or set to spot after button
        _.isNumber(current.turn) || (current.turn = current.button)
        current.turn = (current.turn + 1) % current.spots.length

        return current
    }

    current.spots.forEach(function(s) {
        s.game_score = 0
        s.round_score = 0
    })

    current.turn = null
    current.state = 'finished'

    return current
}

Table.prototype.reset = function() {
    debug('resetting')
    this.resetTimer = null

    this.ref.transaction(function(current) {
        if (current.state != 'finished') return

        debug('resetting, setting state to dead')

        current.spots.forEach(function(s) {
            s.hands = null
            s.game_score = null
            s.user = null
            s.round_score = null
        })

        current.state = 'dead'

        return current
    })
}

Table.prototype.nextGame = function() {
    debug('next game')
    this.nextGameTimer = null

    this.ref.transaction(function(current) {
        debug('next game, setting state to playing')

        current.spots.forEach(function(s) {
            s.hands = null
            s.game_score = null
        })

        current.state = 'playing'

        return current
    })
}

Table.prototype.startResetTimer = function() {
    debug('staring reset timer (10s)')
    this.resetTimer = setTimeout(this.reset.bind(this), 10e3)
}

Table.prototype.startNextGameTimer = function() {
    if (this.nextGameTimer) return
    debug('staring next game timer (5s)')
    this.nextGameTimer = setTimeout(this.nextGame.bind(this), 5e3)
}

Table.prototype.processFinishedState = function(current) {
    current.deck = null

    if (current.game == current.spots.length) {
        debug('one game for each spot has finished')
        current.game = null
        current.button = null
        this.startResetTimer()
    } else {
        this.startNextGameTimer()
    }

    return current
}
