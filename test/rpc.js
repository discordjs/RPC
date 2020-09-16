'use strict';

/* eslint-disable no-console */

try {
  require('wtfnode').init();
} catch (err) { } // eslint-disable-line no-empty

const { Client } = require('../src');

const client = new Client({
  transport: 'ipc',
});

client.transport.on('message', console.log);

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

process.stdin.on('data', async (data) => {
  data = data.toString();
  if (!data.length) {
    return;
  }
  try {
    // eslint-disable-next-line no-eval
    const res = await eval(data.toString());
    console.log(res);
  } catch (error) {
    console.error(error);
  }
});

client.login(auth).catch(console.error);
