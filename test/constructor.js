const { Activity, Client } = require('..');
const client = new Client({ transport: 'ipc' });
const id = '180984871685062656';

client.on('ready', () => {
  const activity = new Activity()
    .setDetails('🐍')
    .setState('slithering')
    .setTimestamps(new Date(), Math.floor(Date.now() / 1000) + 60)
    .setLargeImage('snek_large', 'supa snek')
    .setSmallImage('snek_small', 'smol snek')
    .setParty('snek_party', 1, 5)
    .setMatchSecret('slithers')
    .setJoinSecret('boop')
    .setSpectateSecret('sniff')
    .setInstance(true);
  client.setActivity(activity);
});

client.login(id);