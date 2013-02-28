var debug = require('debug')('bunny:game')
, Firebase = require('../vendor/firebase-node.js')
, FirebaseTokenGenerator = require('firebase-token-generator')
, Table = require('../lib/server/Table')
, config = require('../config')
, ref = new Firebase(config.firebase.url)
, generator = new FirebaseTokenGenerator(config.firebase.secret)
, token = generator.createToken(null, { admin: true, debug: false })

debug('authenticating with firebase')

ref.auth(token, function(error, response) {
    if (error) throw error
    debug('authenticated with firebase')
    debug('setting up table #0')
    var tableRef = ref.child('tables/0')
    , table = new Table(tableRef)
})
