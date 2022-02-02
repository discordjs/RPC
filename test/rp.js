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
  await client.setActivity({
    buttons: [
      { label: 'B1', url: 'https://snek.dev/b1' },
      { label: 'B2', url: 'https://snek.dev/b2' },
    ],
  });
});

client.login(require('./auth')).catch(console.error);
