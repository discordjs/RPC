const { Client } = require('../');

const clientID = '187406016902594560';

const client = new Client({ transport: 'ipc' });

client.on('ready', () => {
  client.setActivity({
    state: 'West of House',
    details: 'Frustration Level: 0',
    startTimestamp: Date.now(),
    endTimestamp: Date.now() + (10 * 60e3),
    largeImageKey: 'logo_large',
    smallImageKey: 'logo_small',
    partyId: 'party1234',
    partySize: 1,
    partyMax: 6,
    matchSecret: 'xyzzy',
    joinSecret: 'join',
    spectateSecret: 'look',
    instance: false,
  }).then(console.log);
});

client.login(clientID).catch(console.error);
