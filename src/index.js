const errors = require('discord.js/src/errors');
const util = require('./Util');
errors.register('RPC_INVALID_TRANSPORT', (name) => `Invalid transport: ${name}`);

module.exports = {
  Client: require('./Client'),
  register(id) {
    return util.register(`discord-${id}`);
  },
};
