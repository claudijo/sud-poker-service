class Broadcaster {
    constructor() {
        this.subscribers = {}
        this.allIds = []
    }

    join(id, socket) {
        this.subscribers[id] = this.subscribers[id] ?? []
        this.subscribers[id].push(socket)
    }

    leave(id, socket) {
        this.subscribers[id]?.splice(this.subscribers[id]?.indexOf(socket), 1)
        if (!this.subscribers[id]?.length) {
            delete this.subscribers[id]
            this.allIds.splice(this.allIds.indexOf(id), 1)
        }
    }
}

module.exports = Broadcaster