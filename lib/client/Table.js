var shared = require('./shared')
, fairness = require('../fairness')

function translateIndex(index) {
    var rank = Math.floor((index - 1) / 4) + 1,
        suit = [2, 0, 1, 3][Math.floor((index - 1) % 4)]
        rank = rank == 13 ? 1 : rank + 1
    return 13 * suit + rank
}

var Table = module.exports = function($el, ref) {
    this.$el = $el
    this.ref = ref

    this.ref.child('rules').once('value', this.onRulesValue.bind(this))
    this.ref.child('button').on('value', this.onButtonValue.bind(this))
    this.ref.child('hash').on('value', this.onHashValue.bind(this))
    this.ref.child('state').on('value', this.onStateValue.bind(this))

    $el.on('unplace', this.onUnplaceCard.bind(this))
    $el.on('click', '.card.is-uncommitted', this.onClickUnlockedPlacedCard.bind(this))
}

Table.prototype.onStateValue = function(snapshot) {
    if (snapshot.val() === 'finished') {
        this.hush = null
        this.ref.child('hush').once('value', this.onHushValue.bind(this))
    }
}

Table.prototype.onHushValue = function(snapshot) {
    var hush  = snapshot.val()

    // the cards were dealt with splice, starting with the player after the button

    // shuffle cards
    var inputs = []
    inputs.push(this.hash)

    for (var si = 0; si < this.rules.spots; si++) {
        var $spot = this.$el.find('.spot-' + si)
        , hash = $spot.data('hash')

        if (_.isUndefined(hash)) {
            console.log('warning, spot ' + i + ' has not supplied a hash', i)
            continue
        }

        inputs.push(hash)
    }

    inputs.push(hush)

    var deck = fairness.shuffle(inputs)

    // initial deal (done in spot order)
    for (var si = 0; si < this.rules.spots; si++) {
        var expected = deck.splice(0, 5)
        , $spot = $('.spot-' + si)

        expected.forEach(function(c) {
            var $card = $spot.find('.card-' + c)
            if (!$card.length) throw new Error('fairness check failed')
        })
    }

    // additional cards
    for (var i = 0; i < (13 - 5); i++) {
        for (var j = 0; j < this.rules.spots; j++) {
            var si = (this.button + 1 + j) % this.rules.spots
            , c = deck.shift()
            , $spot = $('.spot-' + si)
            , $card = $spot.find('.card-' + c)
            if (!$card.length) throw new Error('fairness check failed')
        }
    }
}

Table.prototype.onHashValue = function(snapshot) {
    this.hash = snapshot.val()
}

Table.prototype.onClickUnlockedPlacedCard = function(e) {
    var $card = $(e.target)
    $card.trigger('unplace')
}

Table.prototype.onUnplaceCard = function(e) {
    var $card = $(e.target)
    , $slot = $card.parents('.slot')
    , $spot = $slot.parents('.spot')
    $slot.removeClass('is-taken').append($card)
    var anyUnplaced = !!$spot.find('.dealt .card').length
    $slot.parents('.spot').toggleClass('has-unplaced', anyUnplaced)
    $card.addClass('is-uncommitted')

    var $dealt = $spot.find('.dealt')
    $dealt.prepend($card)
    $spot.addClass('has-unplaced')
}

Table.prototype.onButtonValue = function(snapshot) {
    this.$el.find('.spot').removeClass('is-dealer')
    if (snapshot.val() === null) return
    this.$el.find('.spot-' + snapshot.val()).addClass('is-dealer')
    this.button = snapshot.val()
}

var $cardImage = $('<img>').attr('src', 'media/cards.svg')

Table.prototype.createCard = function(index) {
    var translated = translateIndex(index)

    var $el = $('<div>').addClass('card card-' + index).data('index', index)
    , row = Math.floor((translated - 1) / 13)
    , column = Math.floor((translated - 1) % 13)
    , $card = $cardImage.clone()
    .css({
        top: -(10 + (62 + 8) * row),
        left: -(10 + (42 + 8) * column)
    }).appendTo($el)

    return $el[0]
}

Table.prototype.createSlot = function() {
    var $slot = $('<div>').addClass('slot')
    return $slot
}

Table.prototype.createHand = function(ref, index) {
    var that = this
    , $hand = $('<div>').addClass('hand').data('index', index)
    , capacity = index == 2 ? 3 : 5
    $hand.addClass('hand-' + index)

    for (var slot = 0; slot < capacity; slot++) {
        var $slot = this.createSlot()
        $slot.appendTo($hand)
    }

    ref.on('value', function(snapshot) {
        if (snapshot.val()) return
        $hand.find('.card').remove()
        $hand.find('.slot').removeClass('is-taken')
    })

    ref.on('child_added', function(snapshot) {
        var index = snapshot.val()
        , $dupe = $('.card-' + index)

        if ($dupe.length && $dupe.parents('.hand').length) {
            $dupe.trigger('unplace')
        }

        var card = $dupe.length ? $dupe[0] : that.createCard(index)
        , $slot = $hand.find('.slot:not(.is-taken):first')
        if (!$slot.length) throw new Error('no free slot')
        $slot.trigger('place-card', card)
        $(card).removeClass('is-uncommitted')
    })

    return $hand
}

Table.prototype.onSpotDealtValue = function($spot, snapshot) {
    if (!snapshot.val()) {
        $spot.find('.card.is-uncommitted').removeClass('is-uncommitted')
        $spot.find('.dealt .card').remove()
        $spot.removeClass('is-placing')
        return
    }

    var $dealt = $spot.find('.dealt')
    , cards = snapshot.val().map(this.createCard.bind(this))
    , $cards = $(cards)
    $cards.addClass('is-uncommitted')
    $dealt.append($cards)
    $spot.addClass('has-unplaced')
    $spot.addClass('is-placing')
    var that = this

    if ($spot.find('.autoset').prop('checked')) {
        $cards.each(function(i, e) {
            var $slot = $spot.find('.slot:not(.is-taken):first')
            if ($slot.hasClass('is-taken')) throw new Error('cache derp')
            if (!$slot.length) throw new Error('no spot')
            $slot.trigger('place-card', e)
        })

        that.done($spot)
    }
}

Table.prototype.onSpotUserValue = function($spot, snapshot) {
    $spot.find('.user').html(snapshot.val() ? 'User #' + snapshot.val() : 'Empty Spot')
    $spot.toggleClass('is-taken', !!snapshot.val())
    $spot.toggleClass('is-mine', shared.user && snapshot.val() == shared.user.id)

    if (shared.user && snapshot.val() == shared.user.id) {
        $spot.data('ref').child('dealt').on('value', this.onSpotDealtValue.bind(this, $spot))
    } else {
        $spot.data('ref').child('dealt').off('value')
    }
}

Table.prototype.createSpot = function(ref, index) {
    var $spot = $('<div>')
        .addClass('spot')
        .addClass('spot-' + index)
        .html($('#spot-template').html())
        .data('index', index)
        .data('ref', ref)

    var $hands = $spot.find('.hands')

    for (var hand = 2; hand >= 0; hand--) {
        var $hand = this.createHand(ref.child('hands/' + hand), hand)
        $hand.appendTo($hands)
    }

    ref.child('hash').on('value', this.onSpotHashValue.bind(this, $spot))
    ref.child('user').on('value', this.onSpotUserValue.bind(this, $spot))
    ref.child('round_score').on('value', this.onSpotRoundScoreValue.bind(this, $spot))
    ref.child('game_score').on('value', this.onSpotGameScoreValue.bind(this, $spot))

    return $spot
}

Table.prototype.onSpotHashValue = function($spot, snapshot) {
    $spot.data('hash', snapshot.val())
}

Table.prototype.onSpotRoundScoreValue = function($spot, snapshot) {
    $spot.find('.round-score').html(snapshot.val() == null ? '' : 'Round score: ' + snapshot.val())
}

Table.prototype.onSpotGameScoreValue = function($spot, snapshot) {
    $spot.find('.score').html(snapshot.val() == null ? '' : ', score: ' + snapshot.val())
}

Table.prototype.onClickSit = function() {
    var that =this
    , $spot = this.$el.find('.spot:not(.is-taken):first')
    if (!$spot.length) return alert('All spots taken')

    var hash = fairness.random()

    $spot.data('ref').child('user').set(shared.user.id, function(err) {
        if (err) alert('failed to sit ' + err)

        $spot.data('ref').child('hash').set(hash, function(err) {
            if (err) alert('failed to set hash ' + err)
        })
    })
}

Table.prototype.onRulesValue = function(snapshot) {
    var that = this
    , $spots = this.$el.find('.spots')

    this.rules = snapshot.val()

    for (var si = 0; si < this.rules.spots; si++) {
        var $spot = this.createSpot(this.ref.child('spots/' + si), si)
        $spot.appendTo($spots)
    }

    $('body').on('click', '.sit', this.onClickSit.bind(this))
    .on('click', '.slot:not(.is-taken)', this.onClickNotTakenSlot.bind(this))
    .on('click', '.spot:not(.has-unplaced) .done', this.onClickDone.bind(this))
    .on('place-card', this.onPlaceCard.bind(this))

    var $chat = $('<div class="chat"><ul class="messages" /><input type="text" placeholder="Send chat message + &lt;ENTER&gt;" /></div>')
    .appendTo(this.$el)

    this.ref.child('chat').endAt().limit(10).on('child_added', function(snapshot) {
        $chat.find('.messages')
        .append('<div>&lt;<strong>User #' + snapshot.val().sender + '&gt;</strong> ' + snapshot.val().message + '</div>')
        $chat.find('.messages').scrollTop($chat.find('.messages')[0].scrollHeight)
    })

    $chat.find('input').on('keypress', function(e) {
        if ((e.keyCode || e.which) != 13) return
        var $message = $(e.target)
        , message = $message.val()
        $message.val('')
        if (!message) return
        that.ref.child('chat').push({ sender: shared.user.id, message: message }, function(error) {
            if (error) alert('Send message failed')
        })
    })
}

Table.prototype.onPlaceCard = function(e, $card) {
    var $slot = $(e.target)
    , $spot = $slot.parents('.spot')
    $slot.addClass('is-taken').append($card)
    var anyUnplaced = !!$spot.find('.dealt .card').length
    $slot.parents('.spot').toggleClass('has-unplaced', anyUnplaced)
}

Table.prototype.done = function($spot) {
    var $cards = $spot.find('.card.is-uncommitted')
    , placement = $cards.map(function(i, c) {
        return {
            hand: $(c).parents('.hand').data('index'),
            card: $(c).data('index')
        }
    }).get()
    $spot.find('.card.is-uncommitted').removeClass('is-uncommitted')
    $spot.data('ref').child('pending_committed').set(placement)
}

Table.prototype.onClickDone = function(e) {
    var $spot = $(e.target).parents('.spot:first')
    this.done($spot)
}

Table.prototype.onClickNotTakenSlot = function(e) {
    var $slot = $(e.target)
    , $spot = $slot.parents('.spot')
    , $card = $spot.find('.dealt .card:first')
    if (!$card) return
    $slot.trigger('place-card', $card)
}
