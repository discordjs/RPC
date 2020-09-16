'use strict';

/* eslint-disable no-console */

try {
  require('wtfnode').init();
} catch (err) { } // eslint-disable-line no-empty

const { Client } = require('../src');

const client = new Client({
  transport: 'ipc',
});

const { auth, channelId } = require('./auth');

client.on('ready', async () => {
  try {
    await client.selectTextChannel(channelId);
    await client.subscribe('MESSAGE_CREATE', { channel_id: channelId }, console.log);
    console.log(`Subscribed to MESSAGE_CREATE for ${channelId}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});

client.login(auth).catch(console.error);
