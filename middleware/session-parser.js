const cookieSession = require('cookie-session')

const sessionParser = cookieSession({
    name: 'session',
    keys: process.env.SESSION_SECRETS.split(','),

    // Cookie Options
    maxAge: 24 * 60 * 60 * 1000 * 365, // 1 year
    //secure: process.env.NODE_ENV !== 'development',
    httpOnly: true,
})

module.exports = sessionParser