var _ = require('underscore')

module.exports = _.extend({
    web: {
        port: 4011
    },
    firebase: {
        url: 'https://some.firebaseio.com',
        secret: 'firebase secret'
    }
}, require('./' + (process.env.NODE_ENV || 'local')))
