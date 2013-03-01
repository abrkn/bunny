var debug = require('debug')('bunny:game')
, Firebase = require('../vendor/firebase-node.js')
, FirebaseTokenGenerator = require('firebase-token-generator')
, Table = require('../lib/server/Table')
, config = require('../config')
, ref = new Firebase(config.firebase.url)
, generator = new FirebaseTokenGenerator(config.firebase.secret)
, token = generator.createToken(null, { admin: true, debug: false })
, tables = []

debug('authenticating with firebase')

ref.auth(token, function(error, response) {
    if (error) throw error
    debug('authenticated with firebase')

    ref.child('tables').once('value', function(snapshot) {
        snapshot.forEach(function(snapshot) {
            debug('setting up table #%s', snapshot.name())
            var tableRef = ref.child('tables/' + snapshot.name())
            , table = new Table(tableRef)
            tables.push(table)
        })
    })
})
