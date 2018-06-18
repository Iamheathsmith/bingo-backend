// -- setting up dependencies -- //
import { log, logError } from './utils.js';
import randomString from 'randomstring'; // add this npm package
import Room from './room';

export default (ioServer) => {
  let holdingRoom = 0;
  let lobby = 0;
  let gameRoom = [];
  let roomClone = [];
  let winner = '';
  ioServer.on('connection', socket => {
    log('__CLIENT_CONNECTED__', socket.id);


    // ==================== CREATE ROOM ==================== //
    socket.on('CREATE_ROOM', () => {
      gameRoom = [];
      // generating room code for users
      let roomCode = randomString.generate({
        charset: 'alphabetic',
        length: 4,
      }).toUpperCase();
      // generate a new room code if it already exists
      while (ioServer.all[roomCode]) {
        roomCode = randomString.generate({
          charset: 'alphabetic',
          length: 4,
        }).toUpperCase();
      }
      //creating new room with code generated
      log('__ROOM_CREATED__', roomCode);
      ioServer.all[roomCode] = new Room(socket, roomCode);
      let room = ioServer.all[roomCode];

      socket.roomHost = roomCode;
      room.maxPlayers = 4;


      let data = { 'roomCode': roomCode, 'numPlayers': null, 'maxPlayers': room.maxPlayers, 'roomHost': socket.id };
      socket.emit('SEND_ROOM', JSON.stringify(data));
    });


    // ==================== JOIN ROOM ==================== //
    socket.on('JOIN_ROOM', (roomCode, nickname, socketId) => {
      gameRoom.unshift(socketId);
      let room = ioServer.all[roomCode];
      if (room) {
        // if game has already started in the room, can't join
        if (room.closed) {
          socket.emit('ERROR_JOIN_ROOM', `A game has already started in this room or the room is at capacity.`);
          return;
        }

        // if nickname is already in the room, can't join
        let duplicateNick = false;
        room.players.forEach(player => {
          if (player.nickname === nickname) duplicateNick = true;
        });
        if (duplicateNick) {
          socket.emit('ERROR_JOIN_ROOM', `This nickname is already being used in the room.`);
          return;
        }

        console.log(`${nickname} joined ${roomCode}`);

        // setting variables on socket
        socket.nickname = nickname;
        socket.roomJoined = roomCode;
        socket.join(roomCode);

        // pushes socket into the players array in room
        room.players.push(socket);

        let numPlayers = room.players.length;

        // closing the room if the max players is met
        if (numPlayers >= room.maxPlayers) room.closed = true; //might get rid of this

        // sending number of players in the waiting room back to front end
        socket.emit('JOINED_ROOM', room.maxPlayers);
        let playerNames = room.players.map(player => {
          let playerObj = {
            name: player.nickname,
            wins: 0,
          };
          return playerObj;
        });
        ioServer.in(roomCode).emit('TRACK_PLAYERS', numPlayers, playerNames);
      }
      else {
        // if room doesn't exist
        socket.emit('ERROR_JOIN_ROOM', `This room does not exist.`);
      }
    });


    // ==================== REDIRECT PLAYERS ==================== //
    // when host starts game
    socket.on('REDIRECT_PLAYERS', (roomCode, path) => {
      roomClone = [...gameRoom];
      socket.broadcast.to(roomCode).emit('REDIRECT', path);
    });

    // ==================== END GAME ==================== //
    // when someone leave the game and its under 2 people
    socket.on('END_GAME', (roomCode, name) => {
      let room = ioServer.all[roomCode];
      gameRoom = gameRoom.filter(index => index !== socket.id);
      socket.emit('REDIRECT_ENDGAME');
      ioServer.in(roomCode).emit('REMOVE_PLAYER', name);
      room.players = room.players.filter(player => player.id !== socket.id);
      if (room.players.length < 2) {
        console.log('KILLED THE GAME');
        ioServer.in(roomCode).emit('GAME_OVER');
        gameRoom = [];
        return;
      }
      if (holdingRoom === room.players.length) {
        ioServer.in(roomCode).emit('RESET', winner);
        holdingRoom = 0;
        winner = '';
        roomClone = [...gameRoom];
      }
      socket.leave(roomCode);
      // delete ioServer.all.roomCode;
    });


    // ==================== LEAVE ROOM ==================== //
    // socket.on('LEAVE_ROOM', roomCode => {
    //   let room = ioServer.all[roomCode];
    //   room.players = room.players.filter(player => player.id !== socket.id);
    //   let playerNames = room.players.map(player => player.nickname);
    //   socket.broadcast.to(roomCode).emit('TRACK_PLAYERS', room.players.length, playerNames);
    //   if (room.players.length < 2) {
    //     ioServer.in(roomCode).emit('GAME_OVER');
    //     gameRoom = [];
    //   }
    //   socket.leave(roomCode);
    //   socket.emit('REDIRECT_ENDGAME');
    // });


    // ==================== DISCONNECT ==================== //
    socket.on('disconnect', () => {
      if (socket.roomJoined) {
        let roomCode = socket.roomJoined;
        let room = ioServer.all[roomCode];
        room.players = room.players.filter(player => player.id !== socket.id);
        let playerNames = room.players.map(player => {
          let updatePlayer = {
            name: player.nickname,
            wins: 0,
          };
          return updatePlayer;
        });
        gameRoom = gameRoom.filter(player => player !== socket.id);
        roomClone = roomClone.filter(player => player !== socket.id);
        ioServer.in(roomCode).emit('REMOVE_PLAYER', socket.nickname);
        let nextGo;
        console.log('this is roomcode',roomClone);
        if (gameRoom.length > 2) {
          if (roomClone.length < 1) {
            roomClone = [...gameRoom];
            nextGo = roomClone.shift();
          } else {
            nextGo = roomClone.shift();
          }
        }
        console.log('this is next', nextGo);
        socket.broadcast.to(roomCode).emit('SWITCH TURNS', undefined, nextGo);
        socket.broadcast.to(roomCode).emit('TRACK_PLAYERS', room.players.length, playerNames);
        socket.leave(roomCode);
      }
      if (socket.roomHost) {
        let roomCode = socket.roomHost;
        let room = ioServer.all[roomCode];
        ioServer.in(roomCode).emit('REDIRECT_DISCONNECT');
        socket.leave(roomCode);
        delete ioServer.all.roomCode;
      }
      console.log('__CLIENT_DISCONNECTED__', socket.id);
    });




    // ==================== GAME MODE ==================== //
    // listening for answers from front end
    socket.on('NEXT TURN', (data, roomCode) => {
      let nextGo;
      console.log('gameroom size', gameRoom);
      if (gameRoom.length > 2) {
        if (roomClone.length < 1) {
          roomClone = [...gameRoom];
          nextGo = roomClone.shift();
        } else {
          nextGo = roomClone.shift();
        }
      }
      console.log('this is next go', nextGo);
      socket.broadcast.to(roomCode).emit('SWITCH TURNS', data, nextGo);
    });

    socket.on('GAME WON', (roomCode, data, name) => {
      winner = data;
      ioServer.in(roomCode).emit('GAME OVER', name);
    });

    socket.on('RESET GAME', (roomCode) => {
      let room = ioServer.all[roomCode];
      console.log('am reseting');
      socket.emit('WAITING');
      holdingRoom++;
      if (holdingRoom === room.players.length) {
        ioServer.in(roomCode).emit('RESET', winner);
        holdingRoom = 0;
        winner = '';
        roomClone = [...gameRoom];
      }
    });

    socket.on('READY FOR GAME', (roomCode) => {
      let room = ioServer.all[roomCode];
      lobby++;
      if (lobby === room.players.length) {
        ioServer.in(roomCode).emit('COUNT DOWN');
        lobby = 0;
      }
    });

    socket.on('START GAME', (roomCode) => {
      ioServer.in(roomCode).emit('PLAY GAME');
    });

  });

  ioServer.on('disconnect', () => {
    log('__SERVER_DISCONNECTED__', ioServer.id);
  });

  ioServer.on('error', error => {
    logError('ERROR', error);
  });
};
