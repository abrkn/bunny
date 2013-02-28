var Firebase = require('../vendor/firebase-node.js')
, FirebaseTokenGenerator = require('firebase-token-generator')
, ref = new Firebase('https://bunny.firebaseio.com')
, Table = require('../lib/server/Table')
, config = require('../config')
, debug = require('debug')('bunny:game')
debug('authenticating with firebase')

ref.auth(config.firebase.token, function(error, response) {
    if (error) throw error
    debug('authenticated with firebase')
    debug('setting up table #0')
    var tableRef = ref.child('tables/0')
    , table = new Table(tableRef)
})
