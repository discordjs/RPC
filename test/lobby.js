'use strict';

/* eslint-disable no-console */

try {
  require('wtfnode').init();
} catch (err) {} // eslint-disable-line no-empty

const { Client } = require('../');

const { clientId, clientSecret } = require('./auth');

const client = new Client({ transport: 'ipc' });

client.on('ready', async () => {
  console.log(client.user);

  await client.setActivity({
    state: 'slithering',
    details: '🐍',
    startTimestamp: new Date(),
    largeImageKey: 'snek_large',
    smallImageKey: 'snek_small',
    partyId: 'snek_party',
    partySize: 1,
    partyMax: 1,
    matchSecret: 'slithers',
    joinSecret: 'boop',
    spectateSecret: 'sniff',
    instance: true,
  }).then(console.log, console.error);

  // await client.createLobby('private', 2, { hi: 1 })
  //   .then(console.log, console.error);
});

client.login({
  clientId,
  clientSecret,
  scopes: ['rpc', 'rpc.api'],
}).catch(console.error);
