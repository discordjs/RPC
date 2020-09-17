'use strict';

/* eslint-disable no-console */

try {
  require('wtfnode').init();
} catch (err) {} // eslint-disable-line no-empty

const { Client } = require('../');

const client = new Client({
  transport: 'ipc',
});

client.on('ready', async () => {
  await client.selectTextChannel('201803114049699849');
  console.log(await client.getChannel('201803114049699849'));
  client.destroy()
    .then(() => {
      console.log('closed!');
    });
});

client.login(require('./auth')).catch(console.error);
