var _ = require('underscore')

module.exports = _.extend({
    web: {
        port: 4011
    }
}, require('./' + (process.env.NODE_ENV || 'local')))
