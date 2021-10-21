const sendTo = (sockets, id, event, baseResponse, extra) => {
  sockets.forEach(socket => {
    socket.emit(event, {
      ...baseResponse(socket, id),
      ...extra,
    })
  })
}

const sendToOthers = (socket, id, event, baseResponse = () => ({}), extra = {}) => {
  sendTo(socket.to(id), id, event, baseResponse, extra);
}

const sendToAll = (socket, id, event, baseResponse = () => ({}), extra = {}) => {
  sendTo(socket.in(id), id, event, baseResponse, extra);
};

module.exports = {
  sendToOthers,
  sendToAll,
}