const errors = require('discord.js/src/errors');
const util = require('./util');
errors.register('RPC_INVALID_TRANSPORT', (name) => `Invalid transport: ${name}`);

module.exports = {
  Client: require('./Client'),
  register(id) {
    return util.register(`discord-${id}`);
  },
};
