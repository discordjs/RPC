'use strict';

/* eslint-disable no-console */

try {
  require('wtfnode').init();
} catch (err) {} // eslint-disable-line no-empty

const { Client } = require('../');

const client = new Client({
  transport: 'ipc',
});

client.on('ready', () => {
  client.subscribe('MESSAGE_CREATE', { channel_id: '381886868708655104' }, console.log)
    .catch(console.error);
});

client.login(require('./auth')).catch(console.error);
