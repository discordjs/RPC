<div align="center">
  <br />
  <p>
    <a href="https://discord.gg/bRCvFy9"><img src="https://discordapp.com/api/guilds/222078108977594368/embed.png" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/discord-rpc"><img src="https://img.shields.io/npm/v/discord-rpc.svg?maxAge=3600" alt="NPM version" /></a>
    <a href="https://www.npmjs.com/package/discord-rpc"><img src="https://img.shields.io/npm/dt/discord-rpc.svg?maxAge=3600" alt="NPM downloads" /></a>
    <a href="https://david-dm.org/devsnek/discord-rpc"><img src="https://img.shields.io/david/devsnek/discord-rpc.svg?maxAge=3600" alt="Dependencies" /></a>
    <a href="https://www.patreon.com/devsnek"><img src="https://img.shields.io/badge/donate-patreon-F96854.svg" alt="Patreon" /></a>
  </p>
  <p>
    <a href="https://nodei.co/npm/discord-rpc/"><img src="https://nodei.co/npm/discord-rpc.png?downloads=true&stars=true" alt="NPM info" /></a>
  </p>
</div>

# Discord RPC Client

#### Official RPC extension for [Discord.js](https://discord.js.org), and all types used in this library are from Discord.js

### Rich Presence Example
```javascript
const { Client } = require('discord-rpc');

// Rich Presence only works with IPC, and so it won't work in browser
const client = new Client({ transport: 'ipc' });

client.on('ready', () => {
  // based on the object from
  // https://github.com/discordapp/discord-rpc/blob/master/examples/send-presence
  console.log('Ready, setting rich presence');
  client.setActivity({
    state: 'West of House',
    details: 'Frustration Level: 0',
    startTimestamp: Date.now(),
    endTimestamp: Date.now() + (10 * 60e3),
    largeImageKey: 'canary-large',
    smallImageKey: 'ptb-small',
    partyId: 'party1234',
    partySize: 1,
    partyMax: 6,
    matchSecret: 'xyzzy',
    joinSecret: 'join',
    spectateSecret: 'look',
    instance: false,
  });

  client.subscribe('ACTIVITY_JOIN', ({ secret }) => {
    console.log('Game Join Request', secret);
  });

  client.subscribe('ACTIVITY_SPECTATE', ({ secret }) => {
    console.log('Game Spectate Request', secret);
  });
});

// Log in to RPC with only client id; allows only rich presence.
// If you want to use other features you should see below for an example
// of authorization with scopes, which will still let you use rich presence
// if you are using the `ipc` transport.
client.login('18712471923871230');
```

### Browser Example
```javascript
const { Client } = require('discord-rpc');

const clientID = '187406016902594560';
const scopes = ['rpc', 'rpc.api', 'messages.read'];

// This demonstrates discord's implicit oauth2 flow
// http://discordapi.com/topics/oauth2#implicit-grant

const params = new URLSearchParams(document.location.hash.slice(1));

if (!params.has('access_token')) {
  // Redirect to discord to get an access token
  document.location.href =
    `https://discordapp.com/oauth2/authorize?response_type=token&client_id=${clientID}&scope=${scopes.join('%20')}`;
}

const client = new Client({ transport: 'websocket' });

client.on('ready', () => {
  console.log('Logged in as', client.application.name);
  console.log('Authed for user', client.user.tag);
});

// Log in to RPC with client id and access token
client.login(clientID, { accessToken: params.get('access_token'), scopes });
```
