const errors = require('discord.js/src/errors');
errors.register('RPC_INVALID_TRANSPORT', (name) => `Invalid transport: ${name}`);

module.exports = {
  Client: require('./Client'),
};
