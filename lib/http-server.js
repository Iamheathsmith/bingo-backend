// dependencies
import express from 'express';
import { log } from './utils.js'; // eslint-disable-line
import ioServer from './io-server.js';

// state
const app = express();
const state = {
  isOn: false,
  http: null,
};

app.use(express.static('public'));

const server = module.exports = {};

// interface
server.start = () => {
  return new Promise((resolve, reject) => {
    if (state.isOn) return reject(new Error('USAGE ERROR: the server is already on'));
    state.isOn = true;
    state.http = app.listen(process.env.PORT, () => {
      log('__SERVER_UP__', process.env.PORT);
      const ioServ = require('socket.io')(state.http);
      ioServ.all = {};

      ioServer(ioServ);
      return resolve(server);
    });
  });
};

server.stop = () => {
  return new Promise((resolve, reject) => {
    if (!state.isOn) return reject(new Error('USAGE ERROR: the server is already off'));
    state.http.close(() => {
      log('__SERVER_DOWN__');
      state.isOn = false;
      state.http = null;
      resolve();
    });
  });
};
