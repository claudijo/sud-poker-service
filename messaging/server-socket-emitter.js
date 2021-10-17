const EventEmitter = require('events');
const WebSocketServer = require('ws').Server;
const ULID = require('ulid')
const url = require('url');

const Broadcaster = require('./broadcaster')
const Socket = require('./socket')

class ServerSocketEmitter extends EventEmitter {
    constructor(options) {
        super();

        this.onConnection = this.onConnection.bind(this)
        this.sockets = {}
        this.socket = new WebSocketServer(options);
        this.broadcaster = new Broadcaster()
        this.socket.on('connection', this.onConnection)
        this.middlewares = []
    }

    use(middleware) {
        this.middlewares.push(middleware)
    }

    applyMiddleWares(middlewares, socket, request, callback) {
        const middleware = middlewares.shift()
        if (middleware) {
            middleware(socket, request, error => {
                if (error) {
                    this.emit('error', error)
                    return
                }
                this.applyMiddleWares(middlewares, socket, request, callback)
            })
            return
        }
        callback(socket, request)
    }

    attach(server, path = '/ws') {
        server.on('upgrade', (request, socket, head) => {
            const pathname = url.parse(request.url).pathname;
            if (pathname === path) {
                this.socket.handleUpgrade(request, socket, head, this.onConnection)
            } else {
                socket.destroy()
            }
        })
    }

    onConnection(socket, request) {
        this.applyMiddleWares([...this.middlewares], socket, request, (socket, request) => {
            const id = ULID.ulid().toLowerCase()
            this.sockets[id] = new Socket(socket, id, this.broadcaster, request)

            socket.on('close', () => {
                this.emit('close', this.sockets[id])
                delete this.sockets[id]
            })

            this.emit('connection', this.sockets[id], this)
        })

    }

    // to all clients in room with id
    in(id) {
        return {
            emit: (event, params) => {
                this.broadcaster.subscribers[id]?.sockets.forEach(socket => {
                    socket.emit(event, params)
                })
            }
        }
    }

    // to individual socket id
    to(id) {
        return {
            emit: (event, params) => {
                this.sockets[id]?.emit(event, params)
            }
        }
    }
}

module.exports = ServerSocketEmitter