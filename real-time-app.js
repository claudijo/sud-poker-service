const ServerSocketEmitter = require("./messaging/server-socket-emitter");
const sessionParser = require('./middleware/session-parser')

const noop = () => {}
const response = {
    getHeader: noop,
    setHeader: noop
}

const app = new ServerSocketEmitter({ noServer: true })

app.use((socket, request, next) => {
    sessionParser(request, response, next);
});

app.on('connection', require('./socket-connection-handler'))

module.exports = app
