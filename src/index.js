'use strict';

const util = require('./Util');

module.exports = {
  Client: require('./Client'),
  register(id) {
    return util.register(`discord-${id}`);
  },
};
