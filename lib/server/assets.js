var assets = require('sassets')
, path = require('path')
, _ = require('underscore')
, express = require('express')
, async = require('async')
, fs = require('fs');

module.exports = {
    configure: function(app) {
        var script, scripts = [
            { path: path.join(__dirname, '../../vendor/underscore-min.js') },
            { path: path.join(__dirname, '../../vendor/firebase.js') },
            { path: path.join(__dirname, '../../vendor/firebase-auth-client.js') },
            { path: path.join(__dirname, '../../vendor/jquery-1.9.1.min.js') },
            { type: 'browserify', path: path.join(__dirname, '../client/entry.js') }
        ]

        async.map(scripts, assets.load, function(err, srcs) {
            if (err) throw err
            script = _.reduce(srcs, function(a, b) { return a + b })
        })

        app.get('/scripts.js', function(req, res, next) {
            res.contentType('text/javascript')
            res.end(script)
        })

        var style

        var styles = [
            { path: 'assets/styles.less' }
        ]

        async.map(styles, assets.load, function(err, styles) {
            if (err) throw err
            style = _.reduce(styles, function(a, b) { return a + b })
        })

        app.get('/styles.css', function(req, res, next) {
            res.contentType('text/css')
            res.end(style)
        })

        var indexHtml = fs.readFileSync(path.join(__dirname, '../../assets/index.html'), 'utf8')

        app.get(/\/($|\?)/, function(req, res, next) {
            res.contentType('text/html')
            res.end(indexHtml)
        })

        app.use('/media', express.static(path.join(__dirname, '../../assets/media'), { maxAge: 1000 * 60 * 60 * 24 }))
    }
}
