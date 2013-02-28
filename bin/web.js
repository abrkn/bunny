var express = require('express')
, app = express()
, http = require('http')
, server = http.createServer(app)
, config = require('../config')
, debug = require('debug')('bunny:web')

require('../lib/server/assets.js').configure(app)

debug('listening on port %s', config.web.port)
server.listen(config.web.port)
