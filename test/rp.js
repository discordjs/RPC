const { Client } = require('../');

const clientID = '180984871685062656';

const client = new Client({ transport: 'ipc' });

client.on('ready', () => {
  client.setActivity({
    state: 'slithering',
    details: '🐍',
    startTimestamp: Date.now(),
    endTimestamp: Date.now() + 1337,
    largeImageKey: 'snek_large',
    smallImageKey: 'snek_small',
    partyId: 'snek_party',
    partySize: 1,
    partyMax: 1,
    // matchSecret: 'xyzzy',
    // joinSecret: 'join',
    // spectateSecret: 'look',
    instance: false,
  }).then(console.log);
});

client.login(clientID).catch(console.error);
