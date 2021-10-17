const express = require('express')
const sessionParser = require('./middleware/session-parser')
const app = express()

app.use(sessionParser)

app.use('/api/', require('./routes/api/me'))

module.exports = app