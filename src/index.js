const errors = require('discord.js/src/errors');
const util = require('./Util');
errors.register('RPC_INVALID_TRANSPORT', (name) => `Invalid transport: ${name}`);
errors.register('RPC_CLIENT_ERROR', (m) => m);
errors.register('RPC_CONNECTION_TIMEOUT', (m) => m);

module.exports = {
  Client: require('./Client'),
  register(id) {
    return util.register(`discord-${id}`);
  },
};
