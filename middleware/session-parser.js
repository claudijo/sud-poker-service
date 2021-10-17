const cookieSession = require('cookie-session')

const sessionParser = cookieSession({
    name: 'session',
    keys: ['secret', 'keys'],

    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 * 365 // 1 year
})

module.exports = sessionParser