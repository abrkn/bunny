var _ = require('underscore')
, util = require('util')
, debug = require('debug')('bunny')
, ofcp = require('ofcp')
, fairness = require('../fairness')
, settings = {
    longSetTime: 45,
    shortSetTime: 20
}

function validateSetting(dealt, committed, hands) {
    if (dealt.length !== committed.length) {
        debug('hand disallowed because dealt length %s is different than committed length %s', dealt.length, committed.length)
        return
    }

    // avoid changing the original array
    dealt = dealt.slice()
    dealt.sort(function(a, b) { return a - b })

    var committedCards = _.pluck(committed, 'card').sort(function(a, b) { return a - b })

    if (dealt < committedCards || dealt > committedCards) {
        debug('settling disallowed because committed cards are different from dealt cards')
        return
    }

    var counts = [0, 0, 0]

    if (hands) {
        for (var i = 0; i < 3; i++) {
            if (!hands[i]) continue
            counts[i] += hands[i].length
        }
    }

    committed.forEach(function(p) {
        counts[p.hand]++
    })

    if (counts[0] > 5) {
        debug('hand disallowed because back would have more than five cards')
        return
    }

    if (counts[1] > 5) {
        debug('hand disallowed because middle would have more than five cards')
        return
    }

    if (counts[2] > 3) {
        debug('hand disallowed because front would have more than three cards')
        return
    }

    return true
}

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
    if (snapshot.val() == 'playing') {
        this.ref.transaction(
            this.processPlayingState.bind(this))
    } else if (snapshot.val() == 'finished') {
        this.ref.transaction(
            this.processFinishedState.bind(this))
    }
}

Table.prototype.onTurn = function(snapshot) {
    if (!_.isNumber(snapshot.val())) return

    this.ref.transaction(this.processTurn.bind(this))
}

Table.prototype.startTurnTimer = function(seconds) {
    if (this.turnTimer) {
        debug('not starting duplicate turn timer')
        return
    }
    debug('started turn timer, %d seconds', seconds)
    this.turnTimer = setTimeout(this.onTurnTimer.bind(this), seconds * 1e3)
}

Table.prototype.processTurnTimeout = function(current) {
    if (!this.turnTimer) return
    this.turnTimer = null

    debug('forcefully setting hands')

    var changes

    current.spots.forEach(function(s, i) {
        if (!s.dealt || s.pending_committed || s.committed) return
        debug('forcefully setting for spot %d', i)

        var counts = [0, 0, 0]

        if (s.hands) {
            for (var i = 0; i < 3; i++) {
                if (!s.hands[i]) continue
                counts[i] += s.hands[i].length
            }
        }

        s.pending_committed = []

        s.dealt.forEach(function(c) {
            for (var h = 0; h < 3; h++) {
                if (counts[h] == (h == 2 ? 3 : 5)) continue
                changes = true
                counts[h]++
                s.pending_committed.push({ hand: h, card: c })
                break
            }
        })
    })

    if (!changes) {
        debug('there was nothing to forcefully set')
        return
    }

    return current
}

Table.prototype.onTurnTimer = function() {
    this.ref.transaction(this.processTurnTimeout.bind(this))
}

Table.prototype.processTurn = function(current) {
    this.startTurnTimer(settings.shortSetTime)

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

    this.ref.transaction(this.processSpotUser.bind(this, index))
}

Table.prototype.onSpotHands = function(index, snapshot) {
    if (!snapshot.val()) return

    this.ref.transaction(this.processSpotHands.bind(this, index))
}

Table.prototype.onSpotCommitted = function(index, snapshot) {
    if (!snapshot.val()) return

    this.ref.transaction(
        this.processSpotCommitted.bind(this, index))
}

Table.prototype.onSpotPendingCommitted = function(index, snapshot) {
    if (!snapshot.val()) return

    this.ref.transaction(this.processSpotPendingCommitted.bind(this, index))
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

    debug('enough players seated')

    if (this.startPlayingTimer) {
        debug('start playing timer is already running')
        return
    }

    debug('starting play timer')

    this.startPlayingTimer = setTimeout(this.startPlaying.bind(this), 2e3)

    return current
}

Table.prototype.startPlaying = function() {
    this.startPlayingTimer = null

    this.ref.transaction(function(current) {
        if (current.state !== 'dead') return
        current.state = 'playing'
        return current
    })
}

Table.prototype.processPlayingState = function(current) {
    this.startTurnTimer(_.isNumber(current.turn) ? settings.shortSetTime : settings.longSetTime)

    if (current.deck) {
        return
    }

    debug('shuffling and dealing')

    // shuffle cards
    var inputs = []
    inputs.push(current.hash)

    current.spots.forEach(function(s, i) {
        if (_.isUndefined(s.hash)) {
            debug('warning, spot %d has not supplied a hash', i)
            return
        }

        inputs.push(s.hash)
    })

    inputs.push(current.hush)

    current.deck = fairness.shuffle(inputs)

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

    // concurrency
    if (!spot.pending_committed) return

    if (!validateSetting(spot.dealt, spot.pending_committed, spot.hands)) {
        debug('committed cards denied for spot %s', spotIndex)
        spot.pending_committed = null
        return current
    }

    debug('accepting commited hand from spot %d', spotIndex)

    spot.committed = spot.pending_committed
    spot.pending_committed = null
    spot.dealt = null
    return current
}

Table.prototype.processSpotCommitted = function(spotIndex, current) {
    // concurrency
    if (!current.spots[spotIndex].committed) return

    if (current.spots.some(function(s) {
        return s.dealt && !s.committed
    })) {
        debug('waiting for more players to commit their hands')
        return
    }

    this.turnTimer && clearTimeout(this.turnTimer)
    this.turnTimer = null

    debug('hands committed for all players. placing cards in hands')

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
    if (current.state === 'finished') return

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
        debug('hands set for spot %s and not ready for showdown. passing turn', spotIndex)

        // advance turn if it exists or set to spot after button
        _.isNumber(current.turn) || (current.turn = current.button)
        current.turn = (current.turn + 1) % current.spots.length

        debug('turn pass to spot %d', current.turn)

        return current
    }

    debug('settling game score')

    for (var i = 0; i < current.spots.length; i++) {
        for (var j = 0; j < i; j++) {
            var result = ofcp.settle({
                back: current.spots[i].hands[0],
                mid: current.spots[i].hands[1],
                front: current.spots[i].hands[2]
            }, {
                back: current.spots[j].hands[0],
                mid: current.spots[j].hands[1],
                front: current.spots[j].hands[2]
            }, {
                back: [2, 4, 6, 10, 15, 30],
                mid: [2 * 2, 4 * 2, 6 * 2, 10 * 2, 15 * 2, 30 * 2],
                front: true,
                scoop: 3
            })

            current.spots[i].game_score = result > 0 ? result : 0
            current.spots[j].game_score = result < 0 ? -result : 0

            current.spots[i].round_score = (current.spots[i].round_score || 0) + current.spots[i].game_score
            current.spots[j].round_score = (current.spots[j].round_score || 0) + current.spots[j].game_score
        }
    }

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
            s.hash = null
        })

        current.state = 'dead'
        current.hash = fairness.random()
        current.hush = fairness.random()

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
    debug('staring reset timer (5s)')
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
