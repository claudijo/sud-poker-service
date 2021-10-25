const Table = require('../models/table')
const { sendToAll } = require('./socket');

const actionTimeouts = {}

const getUser = socket => {
  const user = socket.request.session.user;
  return user;
};

const getSeatIndex = (socket, id) => {
  const user = getUser(socket);
  const table = Table.getTable(id);
  return table.reservations.findIndex(reservation => reservation?.uid === user.uid);
}

const clearActionTimeout = id => {
  clearTimeout(actionTimeouts[id])
  delete actionTimeouts[id]
}

const startActionTimeout = (socket, id) => {
  clearActionTimeout(id);

  actionTimeouts[id] = setTimeout(() => {
    try {
      onActionTaken(socket, {id, action: 'fold'})
    } catch (error) {
      console.error('Error folding timed out player', error);
    }
  }, 40 * 1000)
}

const baseResponse = (socket, id) => {
  const index = getSeatIndex(socket, id);

  return {
    seatIndex: index,
    table: Table.getTable(id),
    automaticActions: Table.getAutomaticActions(id, index),
    holeCards: Table.getHoleCards(id, index),
  }
}

const handlePostActionEvents = (socket, id) => {
  if (Table.isHandInProgress(id) && !Table.isBettingRoundInProgress(id)) {
    Table.endBettingRound(id);
    sendToAll(socket, id, 'bettingRoundEnd', baseResponse)

    if (Table.areBettingRoundsCompleted(id)) {
      Table.showdown(id)
      sendToAll(socket, id, 'showdown', baseResponse)
      clearActionTimeout(id)

      if (Table.numOfSeatedPlayers(id) > 1) {
        Table.startHand(id)
        sendToAll(socket, id, 'startHand', baseResponse)

        startActionTimeout(socket, id);
      }
    } else {
      startActionTimeout(socket, id);
    }
  } else if (Table.isHandInProgress(id)) {
    startActionTimeout(socket, id);
  }
}

const onActionTaken = (socket, params) => {
  const { id, action, betSize } = params;
  const prevSeats = Table.getSeats(id);
  const unfoldingAutomaticActions = Table.unfoldingAutomaticActions(id);

  const actor = Table.getPlayerToAct(id);
  Table.actionTaken(id, action, betSize);

  const areAutomaticActionsAmended = Table.isBettingRoundInProgress(id)
    && unfoldingAutomaticActions[Table.getPlayerToAct(id)]

  if (areAutomaticActionsAmended) {
    // Automatic action was amended. Just nullify the array.
    unfoldingAutomaticActions.fill(null);
  }

  const extra = {
    actor,
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

  sendToAll(socket, id, 'actionTaken', baseResponse, extra);
  handlePostActionEvents(socket, id)
}

module.exports = {
  getUser,
  getSeatIndex,
  startActionTimeout,
  baseResponse,
  onActionTaken,
  handlePostActionEvents,
}