'use strict';

/* eslint-disable no-console */

try {
  require('wtfnode').init();
} catch (err) {} // eslint-disable-line no-empty

const { Client } = require('../');

const { clientId } = require('./auth');

const client = new Client({ transport: 'ipc' });

client.on('ready', () => {
  console.log(client);

  client.subscribe('ACTIVITY_JOIN', ({ secret }) => {
    console.log('should join game with secret:', secret);
  });

  client.subscribe('ACTIVITY_SPECTATE', ({ secret }) => {
    console.log('should spectate game with secret:', secret);
  });

  client.subscribe('ACTIVITY_JOIN_REQUEST', (user) => {
    console.log('user wants to join:', user);
  });

  client.setActivity({
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
  }).then(console.log);
});

client.login({ clientId }).catch(console.error);
