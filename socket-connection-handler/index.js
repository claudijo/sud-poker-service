const debug = require('debug')('poker-service:socket-connection-handler');
const Table = require('../models/table');
const { getUser } = require('../utils/game-event-handler');
const { getSeatIndex } = require('../utils/game-event-handler');
const { onActionTaken } = require('../utils/game-event-handler');
const { startActionTimeout } = require('../utils/game-event-handler');
const { baseResponse } = require('../utils/game-event-handler');
const { handlePostActionEvents } = require('../utils/game-event-handler');
const { sendToOthers } = require('../utils/socket');
const { sendToAll } = require('../utils/socket');

const reconnectTimeouts = {};

const socketConnectionHandler = (socket, app) => {
  debug('Socket connection');

  socket.on('error', error => {
    console.error('Socket error', error);
  });

  socket.on('close', event => {
    debug('Socket close');
    try {
      const ids = [...socket.subscriptions];
      const user = getUser(socket);
      if (user?.uid) {
        clearTimeout(reconnectTimeouts[user.uid]);
        reconnectTimeouts[user.uid] = setTimeout(() => {
          ids.forEach(id => {
            const index = getSeatIndex(socket, id);
            Table.standUp(id, index);
            Table.cancelReservation(id, index);
            sendToOthers(socket, id, 'standUp', baseResponse);
            handlePostActionEvents(socket, id);
          });
        }, 3 * 60 * 1000);
      }
      socket.leaveAll();
    } catch (error) {
      debug('Socket close error', error);
    }
  });

  socket.on('join', (params, fn) => {
    debug('join', params);
    try {
      const { id } = params;
      const user = getUser(socket);
      if (user?.uid) {
        clearTimeout(reconnectTimeouts[user.uid]);
        delete reconnectTimeouts[user.uid];
      }
      socket.join(id);
      fn(null, baseResponse(socket, id));
    } catch (error) {
      debug('join error', error);
    }
  });

  socket.on('reserveSeat', (params, fn) => {
    debug('reserveSeat', params);
    try {
      const { id, index } = params;
      const user = getUser(socket);
      Table.setReservation(id, index, user);
      fn(null, baseResponse(socket, id));

      sendToOthers(socket, id, 'reserveSeat', baseResponse);
    } catch (error) {
      debug('reserveSeat error', error);
      fn(error);
    }
  });

  socket.on('cancelReservation', (params, fn) => {
    debug('cancelReservation', params);
    try {
      const { id } = params;
      const index = getSeatIndex(socket, id);
      Table.cancelReservation(id, index);
      fn(null, baseResponse(socket, id));
      sendToOthers(socket, id, 'cancelReservation', baseResponse);
    } catch (error) {
      debug('cancelReservation error', error);
      fn(error);
    }
  });

  socket.on('sitDown', (params, fn) => {
    debug('sitDown', params);
    try {
      const { id, name, buyIn, avatarStyle } = params;
      const user = getUser(socket);
      const index = getSeatIndex(socket, id);

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
      sendToOthers(socket, id, 'sitDown', baseResponse);

      if (Table.numOfSeatedPlayers(id) > 1 && !Table.isHandInProgress(id)) {
        Table.startHand(id);
        sendToAll(socket, id, 'startHand', baseResponse);
        startActionTimeout(socket, id);
      }
    } catch (error) {
      debug('sitDown error', error);
      fn(error);
    }
  });

  socket.on('standUp', (params, fn) => {
    debug('standUp', params);

    try {
      const { id } = params;
      const index = getSeatIndex(socket, id);
      Table.standUp(id, index);
      Table.cancelReservation(id, index);
      fn(null, baseResponse(socket, id));
      sendToOthers(socket, id, 'standUp', baseResponse);

      handlePostActionEvents(socket, id);
    } catch (error) {
      debug('standUp error', error);
      fn(error);
    }
  });

  socket.on('actionTaken', (params, callback) => {
    debug('onActionTaken', params)
    try {
      const { id } = params;
      const index = getSeatIndex(socket, id)

      if (index === -1) {
        throw new Error('Player not found at table');
      }

      if (Table.getPlayerToAct(id) !== index) {
        throw new Error('Action out of turn');
      }

      onActionTaken(socket, params);

      callback(null);
    } catch(error) {
      debug('onActionTaken Error', error)
      callback(error);
    }
  });

  socket.on('setAutomaticAction', (params, fn) => {
    debug('setAutomaticAction', params);
    try {
      const { id, action } = params;
      const index = getSeatIndex(socket, id);
      Table.setAutomaticAction(id, index, action);
      fn(null, {
        automaticActions: Table.getAutomaticActions(id, index),
      });
    } catch (error) {
      debug('setAutomaticAction error', error);
      fn(error);
    }
  });
};

module.exports = socketConnectionHandler;