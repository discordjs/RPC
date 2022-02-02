'use strict';

/* eslint-disable no-console */

try {
  require('wtfnode').init();
} catch (err) {} // eslint-disable-line no-empty

const { Client } = require('../');

const client = new Client({
  transport: 'ipc',
});

client.on('VOICE_CHANNEL_SELECT', (args) => {
  client.subscribe('VOICE_STATE_UPDATE', { channel_id: args.channel_id });
});

client.on('VOICE_STATE_UPDATE', (args) => {
  console.log(args);
});

client.on('ready', async () => {
  client.subscribe('VOICE_CHANNEL_SELECT');
});

client.login(require('./auth')).catch(console.error);
