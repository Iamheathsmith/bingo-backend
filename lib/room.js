import {log} from './utils'; //eslint-disable-line

module.exports = class Room {
  constructor(socket, roomCode) {
    this.host = socket;
    this.code = roomCode;
    // players is an array of each player's socket
    this.players = [];
    this.started = false;

    socket.join(roomCode);
  }

  startGame(roomCode, socket, ioServer) { //removed a few items. might need it back
    this.started = true;
    this.players.map(player => player.score = 0);
  }
};
