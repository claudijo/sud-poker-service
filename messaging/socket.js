const EventEmitter = require('events');
const { serializeError } = require('serialize-error');

class Socket extends EventEmitter {
  constructor(socket, id, broadcaster, request) {
    super();

    this.id = id;
    this.socket = socket;
    this.broadcaster = broadcaster;
    this.request = request;
    this.subscriptions = [];

    this.onMessage = this.onMessage.bind(this);
    this.onClose = this.onClose.bind(this);

    this.socket.on('message', this.onMessage);
    this.socket.on('close', this.onClose);
  }

  // basic emit
  emit(event, params) {
    const message = {
      ev: event,
      p: params,
    };
    this.send(0, message);
  }

  // to all clients in room with id except the sender
  to(id) {
    const that = this;
    return {
      forEach: callback => {
        this.broadcaster.subscribers[id]?.forEach(socket => {
          if (socket !== that) {
            callback(socket)
          }
        })
      },
      emit: (event, params) => {
        this.broadcaster.subscribers[id]?.forEach(socket => {
          if (socket !== that) {
            socket.emit(event, params);
          }
        });
      },
    };
  }

  // to all clients in room with id
  in(id) {
    return {
      forEach: callback => {
        this.broadcaster.subscribers[id]?.forEach(callback)
      },
      emit: (event, params) => {
        this.broadcaster.subscribers[id]?.forEach(socket => {
          socket.emit(event, params)
        })
      }
    };
  }

  join(id) {
    this.broadcaster.join(id, this);
    this.subscriptions.push(id);
  }

  leave(id) {
    this.broadcaster.leave(id, this);
    this.subscriptions.splice(this.subscriptions.indexOf(id), 1);
  }

  leaveAll() {
    let index = this.subscriptions.length;
    while (--index > -1) {
      this.leave(this.subscriptions[index]);
    }
  }

  onMessage(message) {
    try {
      const payload = JSON.parse(message);
      const { ch: channel, ev: event, id, p: params, e: error } = payload;
      switch (channel) {
        case 0:
          const replyCallback = id === undefined
            ? () => {
            }
            : (error, params) => {
              this.send(1, {
                id,
                e: serializeError(error),
                p: params,
              });
            };
          super.emit(event, params, replyCallback);
          return;
        case 1:
          throw new Error('Ack not implemented');

      }
    } catch (error) {
      super.emit('error', error);
    }
  }

  onClose(code) {
    super.emit('close', code);
  }

  send(channel, payload) {
    try {
      payload.ch = channel;
      const message = JSON.stringify(payload);
      this.socket.send(message);
    } catch (error) {
      super.emit('error', error);
    }
  }
}

module.exports = Socket;