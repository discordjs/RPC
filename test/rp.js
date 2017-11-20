const { Client } = require('../');

const clientID = '180984871685062656';

const client = new Client({ transport: 'ipc' });

client.on('ready', async() => {
  await client.subscribe('ACTIVITY_JOIN', ({ secret }) => {
    console.log('should join game with secret:', secret);
  });

  await client.subscribe('ACTIVITY_SPECTATE', ({ secret }) => {
    console.log('should spectate game with secret:', secret);
  });

  await client.subscribe('ACTIVITY_JOIN_REQUEST', (user) => {
    console.log('user wants to join:', user);
  });

  await client.setActivity({
    state: 'slithering',
    details: '🐍',
    startTimestamp: Date.now(),
    endTimestamp: Date.now() + 1337,
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

  client.destroy();
});

client.login(clientID).catch(console.error);
