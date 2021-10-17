const Poker = require('poker-ts');

const tables = {};

const winnerMapper = pots => pots.map(winner => {
  const [seatIndex, hand, holeCards] = winner;
  return {
    seatIndex,
    ...hand,
    holeCards,
  };
});

const serializeTable = table => {
  const { reservations, id } = table;
  return {
    id,
    reservations,

    // Returns the state of the players seated at the table
    seats: table.seats(),

    // Returns the current bet structure at the table
    forcedBets: table.forcedBets(),

    // Returns true if hand is in progress
    isHandInProgress: table.isHandInProgress(),

    // Returns true if betting round is in progress
    isBettingRoundInProgress: table.isHandInProgress() ? table.isBettingRoundInProgress() : undefined,

    // Returns true if all betting rounds are completed
    areBettingRoundsCompleted: table.isHandInProgress() ? table.areBettingRoundsCompleted() : undefined,

    // Returns the state of the players currently in the hand.
    handPlayers: table.isHandInProgress() ? table.handPlayers() : undefined,

    // Returns dealer button seat index
    button: table.isHandInProgress() ? table.button() : undefined,

    // Returns the legal actions and available bet range for the active player
    legalActions: table.isHandInProgress() && table.isBettingRoundInProgress() ? table.legalActions() : undefined,

    // Returns the seat index of the player to act
    playerToAct: table.isHandInProgress() && table.isBettingRoundInProgress() ? table.playerToAct() : undefined,

    // Returns the number of active players in the active hand.
    numActivePlayers: table.isHandInProgress() ? table.numActivePlayers() : undefined,

    // Returns the state of all pots in the active hand
    pots: table.isHandInProgress() ? table.pots() : undefined,

    // Returns the current round of betting (preflop|flop|turn|river)
    roundOfBetting: table.isHandInProgress() ? table.roundOfBetting() : undefined,

    // Returns the community cards for the active hand
    communityCards: table.isHandInProgress() ? table.communityCards() : undefined,

    // Return winner hands per pot
    winners: !table.isHandInProgress() ? table.winners().map(winnerMapper) : undefined,
  };
};

const getTable = id => {
  const table = tables[id];
  if (!table) {
    throw new Error('Table not found');
  }

  return serializeTable(table);
};

const createTable = (id, forcedBets) => {
  if (tables[id]) {
    throw new Error('Table already exists');
  }

  const table = new Poker.Table(forcedBets);
  table.reservations = new Array(9).fill(null);
  table.id = id;
  tables[id] = table;

  return serializeTable(table);
};

const setReservation = (id, index, player) => {
  const table = tables[id];
  if (!table) {
    throw new Error('Table not found');
  }

  if (typeof index !== 'number') {
    throw new Error('Invalid seat index');
  }

  if (index < 0 || index > 8) {
    throw new Error('Seat index out of range');
  }

  if (table.reservations[index]) {
    throw new Error('Seat is already reserved');
  }

  if (table.reservations.find(reservation => reservation && reservation.uid === player.uid)) {
    throw new Error('Player already has a reserved a seat at this table');
  }

  table.reservations[index] = player;

  return serializeTable(table);
};

const updateReservation = (id, index, player) => {
  const table = tables[id];

  if (!table) {
    throw new Error('Table not found');
  }

  if (!table.reservations[index]) {
    throw new Error('Missing reservation');
  }

  if (table.reservations[index].uid !== player.uid) {
    throw new Error('Reservation owned by someone else');
  }

  table.reservations[index] = player;

  return serializeTable(table);
};

const cancelReservation = (id, index) => {
  const table = tables[id];
  if (!table) {
    throw new Error('Table not found');
  }

  if (index === -1) {
    throw new Error('Missing seat index')
  }

  if (!table.reservations[index]) {
    throw new Error('Seat is not reserved');
  }

  if (table.seats[index]) {
    throw new Error('You need to stand up before cancel reservation');
  }

  table.reservations[index] = null;

  return serializeTable(table);
};

const sitDown = (id, index, buyIn) => {
  const table = tables[id];
  table.sitDown(index, buyIn);
  return serializeTable(table);
};

const startHand = id => {
  const table = tables[id];
  table.startHand();
  return serializeTable(table);
};

const actionTaken = (id, action, betSize) => {
  const table = tables[id];
  table.actionTaken(action, betSize);
  return serializeTable(table);
};

const setAutomaticAction = (id, index, action) => {
  const table = tables[id];
  table.setAutomaticAction(index, action);
  return serializeTable(table);
};

const getAutomaticActions = (id, index) => {
  if (index === -1) {
    return;
  }

  const table = tables[id];
  return {
    automaticAction: table.isHandInProgress() ? table.automaticActions()[index] : null,
    canSetAutomaticActions: table.isHandInProgress() && table.isBettingRoundInProgress() ? table.canSetAutomaticActions(index) : false,
    legalAutomaticActions: table.isHandInProgress() && table.isBettingRoundInProgress() ? table.legalAutomaticActions(index) : [],
  };
};

const getHoleCards = (id, index) => {
  if (index === -1) {
    return [];
  }

  const table = tables[id];
  const holeCards = table.isHandInProgress() ? table.holeCards() : [];
  return holeCards[index] ?? [];
};

const endBettingRound = id => {
  const table = tables[id];
  table.endBettingRound();
  return serializeTable(table);
};

const showdown = id => {
  const table = tables[id];
  table.showdown();
  return serializeTable(table);
};

const numOfSeatedPlayers = id => {
  const table = tables[id];
  return table.seats().filter(seat => !!seat).length;
};

const isHandInProgress = id => {
  const table = tables[id];
  return table.isHandInProgress();
};

const isBettingRoundInProgress = id => {
  const table = tables[id];
  return table.isBettingRoundInProgress();
};

const areBettingRoundsCompleted = id => {
  const table = tables[id];
  return table.areBettingRoundsCompleted()
};

const getPlayerToAct = id => {
  const table = tables[id];
  return table.playerToAct();
};

const getHandPlayers = id => {
  const table = tables[id];
  return table.handPlayers()
}

const getSeats = id => {
  const table = tables[id]
  return table.seats();
}

const unfoldingAutomaticActions = id => {
  const table = tables[id];
  const automaticActions = table.automaticActions();
  let index = table.playerToAct();

  let nullifyAutomaticAction = false;
  do {
    ++index;
    if (index === automaticActions.length) {
      index = 0;
    }

    if (!table.canSetAutomaticActions(index)) {
      continue;
    }

    if (nullifyAutomaticAction) {
      automaticActions[index] = null;
      continue;
    }

    if (automaticActions[index] === null) {
      nullifyAutomaticAction = true;
    }

  } while (index !== table.playerToAct());

  return automaticActions;
};

// Create dummy table for
createTable('sandbox', { ante: 0, smallBlind: 1, bigBlind: 2 });

module.exports = {
  getAutomaticActions,
  getHoleCards,
  startHand,
  createTable,
  getTable,
  setReservation,
  cancelReservation,
  updateReservation,
  sitDown,
  actionTaken,
  endBettingRound,
  unfoldingAutomaticActions,
  showdown,
  setAutomaticAction,
  numOfSeatedPlayers,
  isHandInProgress,
  isBettingRoundInProgress,
  areBettingRoundsCompleted,
  getPlayerToAct,
  getHandPlayers,
  getSeats,
};