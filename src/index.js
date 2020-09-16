'use strict';

const util = require('./util');
const structures = require('./struct');

module.exports = {
  Constants: require('./constants'),

  // Classes
  ClientApplication: structures.ClientApplication,
  Channel: structures.Channel,
  Client: require('./client'),
  Guild: structures.Guild,
  User: structures.User,
  UserFlags: structures.UserFlags,

  register(id) {
    return util.register(`discord-${id}`);
  },
};
