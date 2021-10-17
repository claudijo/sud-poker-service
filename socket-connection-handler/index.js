const debug = require('debug')('poker-service:socket-connection-handler');
const Table = require('../models/table');

const baseResponse = (socket, id) => {
  const index = getSeatIndex(socket, id);

  return {
    seatIndex: index,
    table: Table.getTable(id),
    automaticActions: Table.getAutomaticActions(id, index),
    holeCards: Table.getHoleCards(id, index),
  }
}

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
}


const getUser = socket => {
  const user = socket.request.session.user;

  if (!user) {
    throw new Error('Missing user');
  }

  return user;
};

const getSeatIndex = (socket, id) => {
  const user = getUser(socket);
  const table = Table.getTable(id);
  return table.reservations.findIndex(reservation => reservation?.uid === user.uid);
};

const socketConnectionHandler = (socket, app) => {
  debug('Socket connection');

  socket.on('error', error => {
    console.error('Socket error', error);
  });

  socket.on('close', event => {
    debug('Socket close');
    try {
      socket.leaveAll();
    } catch(error) {
      debug('Socket close error', error);
    }
  });

  socket.on('join', (params, fn) => {
    debug('join', params)
    try {
      const { id } = params;
      socket.join(id);
      fn(null, baseResponse(socket, id));
    } catch(error) {
      debug('join error', error)
    }
  });

  socket.on('reserveSeat', (params, fn) => {
    debug('reserveSeat', params)
    try {
      const { id, index } = params;
      const user = getUser(socket);
      Table.setReservation(id, index, user);
      fn(null, baseResponse(socket, id));

      sendToOthers(socket, id, 'reserveSeat', baseResponse)
    } catch (error) {
      debug('reserveSeat error', error)
      fn(error);
    }
  });

  socket.on('cancelReservation', (params, fn) => {
    debug('cancelReservation', params)
    try {
      const { id } = params;
      const index = getSeatIndex(socket, id);
      Table.cancelReservation(id, index);
      fn(null, baseResponse(socket, id));
      sendToOthers(socket, id, 'cancelReservation', baseResponse)
    } catch (error) {
      debug('cancelReservation error', error)
      fn(error);
    }
  });

  socket.on('sitDown', (params, fn) => {
    debug('sitDown', params)
    try {
      const { id, name, buyIn, avatarStyle } = params;
      const user = getUser(socket);
      const index = getSeatIndex(socket, id)

      if (typeof name !== 'string') {
        throw new Error('Missing display name');
      }

      if (name.trim().length < 2) {
        throw new Error('Too short display name');
      }

      if (typeof avatarStyle !== 'string') {
        throw new Error('Missing avatar style');
      }

      if (isNaN(buyIn)) {
        throw new Error('Invalid buy-in');
      }

      if (buyIn < 1 || buyIn > 99999) {
        throw new Error('Buy-in out of range');
      }

      Table.updateReservation(id, index, {
        ...user,
        name: name.trim(),
        avatarStyle,
      });

      Table.sitDown(id, index, buyIn);

      fn(null, baseResponse(socket, id));
      sendToOthers(socket, id, 'sitDown', baseResponse)

      if (Table.numOfSeatedPlayers(id) > 1 && !Table.isHandInProgress(id)) {
        Table.startHand(id)
        sendToAll(socket, id, 'startHand', baseResponse)
      }
    } catch (error) {
      debug('sitDown error', error)
      fn(error);
    }
  });

  socket.on('actionTaken', (params, fn) => {
    debug('actionTaken', params)
    try {
      const { id, action, betSize } = params;
      const index = getSeatIndex(socket, id)

      if (index === -1) {
        throw new Error('Player not found at table');
      }

      if (Table.getPlayerToAct(id) !== index) {
        throw new Error('Action out of turn');
      }

      const prevSeats = Table.getSeats(id);

      const unfoldingAutomaticActions = Table.unfoldingAutomaticActions(id);
      Table.actionTaken(id, action, betSize);

      const areAutomaticActionsAmended = Table.isBettingRoundInProgress(id)
        && unfoldingAutomaticActions[Table.getPlayerToAct(id)]

      if (areAutomaticActionsAmended) {
        // Automatic action was amended. Just nullify the array and don't bother
        // with sending previous table state
        unfoldingAutomaticActions.fill(null);
      }

      const extra = {
        actor: getSeatIndex(socket, id),
        action,
        unfoldingAutomaticActions: unfoldingAutomaticActions.map((action, index) => {
          switch(action) {
            case 'check/fold':
              return Table.getHandPlayers(id)[index] ? 'check' : 'fold';
            case 'call any':
              return prevSeats[index].betSize < Table.getSeats(id)[index].betSize
                ? 'call'
                // Automatic action call (any) was preceded by checks
                : 'check'
            default:
              return action;
          }
        }),
      }

      fn(null);
      sendToAll(socket, id, 'actionTaken', baseResponse, extra);

      if (Table.isHandInProgress(id) && !Table.isBettingRoundInProgress(id)) {
        Table.endBettingRound(id);
        sendToAll(socket, id, 'bettingRoundEnd', baseResponse)

        if (Table.areBettingRoundsCompleted(id)) {
          Table.showdown(id)
          sendToAll(socket, id, 'showdown', baseResponse)

          if (Table.numOfSeatedPlayers(id) > 1) {
            Table.startHand(id)
            sendToAll(socket, id, 'startHand', baseResponse)
          }
        }
      }
    } catch (error) {
      debug('actionTaken error', error)
      fn(error);
    }
  });

  socket.on('setAutomaticAction', (params, fn) => {
    debug('setAutomaticAction', params)
    try {
      const { id, action } = params;
      const index = getSeatIndex(socket, id);
      Table.setAutomaticAction(id, index, action);
      fn(null, {
        automaticActions: Table.getAutomaticActions(id, index)
      });
    } catch (error) {
      debug('setAutomaticAction error', error)
      fn(error);
    }
  });
};

module.exports = socketConnectionHandler;