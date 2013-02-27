var Firebase = require('../vendor/firebase-node.js')
, ref = new Firebase('https://bunny.firebaseio.com')
, tableRef = ref.child('tables/0')
, Table = require('../lib/server/Table')
, table = new Table(tableRef)

var express = require('express')
, app = express()
, browserify = require('browserify')
, fs = require('fs')
, path = require('path')
, http = require('http')
, server = http.createServer(app)

require('../lib/server/assets.js').configure(app)

server.listen(4011);
