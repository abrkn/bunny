function translateIndex(index) {
    var rank = Math.floor((index - 1) / 4) + 1,
        suit = [2, 0, 1, 3][Math.floor((index - 1) % 4)]
        rank = rank == 13 ? 1 : rank + 1
    return 13 * suit + rank
}

var shared = require('./shared')
, Table = module.exports = function($el, ref) {
    this.$el = $el
    this.ref = ref

    this.ref.child('rules').once('value', this.onRulesValue.bind(this))
    this.ref.child('button').on('value', this.onButtonValue.bind(this))
}


Table.prototype.onButtonValue = function(snapshot) {
    this.$el.find('.spot').removeClass('is-dealer')
    if (snapshot.val() === null) return
    this.$el.find('.spot-' + snapshot.val()).addClass('is-dealer')
}

Table.prototype.createCard = function(index) {
    var translated = translateIndex(index)

    var $el = $('<div>').addClass('card card-' + index).data('index', index)
    , row = Math.floor((translated - 1) / 13)
    , column = Math.floor((translated - 1) % 13)
    , $img = $('<img>')
    .attr('src', 'http://tekeye.biz/download/small_playing_cards.svg')
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
        console.log('hand has been set to null. removing all cards')
        $hand.find('.card').remove()
        $hand.find('.slot').removeClass('is-taken')
    })

    ref.on('child_added', function(snapshot) {
        var index = snapshot.val()
        , $dupe = $('.card-' + index)

        if ($dupe.length && $dupe.parents('.hand').length) {
            // TODO: generalize with trigger for removing from slot or dealt
            $dupe.parent().removeClass('is-taken')
        }

        $dupe.length && console.log('will re-use existing card')
        var card = $dupe.length ? $dupe[0] : that.createCard(index)
        , $slot = $hand.find('.slot:not(.is-taken):first')
        if (!$slot.length) throw new Error('no free slot')
        $slot.trigger('place-card', card)
    })

    return $hand
}

Table.prototype.onSpotDealtValue = function($spot, snapshot) {
    if (!snapshot.val()) {
        console.log('uncommitted', $spot.find('.is-uncommitted'))
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
    console.log('user', snapshot.val(), 'to spot', $spot.data('index'))
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

    ref.child('user').on('value', this.onSpotUserValue.bind(this, $spot))
    ref.child('round_score').on('value', this.onSpotRoundScoreValue.bind(this, $spot))
    ref.child('game_score').on('value', this.onSpotGameScoreValue.bind(this, $spot))

    return $spot
}

Table.prototype.onSpotRoundScoreValue = function($spot, snapshot) {
    $spot.find('.round-score').html(snapshot.val() == null ? '' : 'Round score: ' + snapshot.val())
}

Table.prototype.onSpotGameScoreValue = function($spot, snapshot) {
    $spot.find('.score').html(snapshot.val() == null ? '' : ', score: ' + snapshot.val())
}

Table.prototype.onClickSit = function() {
    var $spot = this.$el.find('.spot:not(.is-taken):first')
    if (!$spot.length) return alert('All spots taken')
    $spot.data('ref').child('user').set(shared.user.id)
}

Table.prototype.onRulesValue = function(snapshot) {
    var $spots = this.$el.find('.spots')
    for (var si = 0; si < snapshot.val().spots; si++) {
        var $spot = this.createSpot(this.ref.child('spots/' + si), si)
        $spot.appendTo($spots)
    }

    $('body').on('click', '.sit', this.onClickSit.bind(this))
    .on('click', '.slot:not(.is-taken)', this.onClickNotTakenSlot.bind(this))
    .on('click', '.spot:not(.has-unplaced) .done', this.onClickDone.bind(this))
    .on('place-card', this.onPlaceCard.bind(this))
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
    console.log('setting placement', placement)
    $spot.find('.card.is-uncommitted').removeClass('is-uncommitted')
    $spot.data('ref').child('pending_committed').set(placement)
}

Table.prototype.onClickDone = function(e) {
    console.log('done clicked')
    var $spot = $(e.target).parents('.spot:first')
    this.done($spot)
}

Table.prototype.onClickNotTakenSlot = function(e) {
    var $slot = $(e.target)
    , $spot = $slot.parents('.spot')
    , $card = $spot.find('.dealt .card:first')
    if (!$card) return console.log('no card to set')
    $slot.trigger('place-card', $card)
}
