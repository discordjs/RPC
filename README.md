<div align="center">
  <br />
  <p>
    <a href="https://discord.gg/bRCvFy9"><img src="https://discordapp.com/api/guilds/222078108977594368/embed.png" alt="Discord server" /></a>
    <a href="https://www.npmjs.com/package/discord-rpc"><img src="https://img.shields.io/npm/v/discord-rpc.svg?maxAge=3600" alt="NPM version" /></a>
    <a href="https://www.npmjs.com/package/discord-rpc"><img src="https://img.shields.io/npm/dt/discord-rpc.svg?maxAge=3600" alt="NPM downloads" /></a>
    <a href="https://david-dm.org/discordjs/RPC"><img src="https://img.shields.io/david/discordjs/RPC.svg?maxAge=3600" alt="Dependencies" /></a>
  </p>
  <p>
    <a href="https://nodei.co/npm/discord-rpc/"><img src="https://nodei.co/npm/discord-rpc.png?downloads=true&stars=true" alt="NPM info" /></a>
  </p>
</div>

# Discord.js RPC Extension

### [Documentation](https://discord.js.org/#/docs/rpc/)

### [Rich Presence Example](https://github.com/discordjs/RPC/blob/master/example)

### __Browser__ Example

```javascript
const clientId = '287406016902594560';
const scopes = ['rpc', 'rpc.api', 'messages.read'];

const client = new RPC.Client({ transport: 'websocket' });

client.on('ready', () => {
  console.log('Logged in as', client.application.name);
  console.log('Authed for user', client.user.username);

  client.selectVoiceChannel('81384788862181376');
});

// Log in to RPC with client id
client.login({ clientId, scopes });
```

### __Local__ Example

```javascript
const RPC = require("discord-rpc")
const client = new RPC.Client({ transport: "ipc" })
const buttons = [{ label: 'label', url: 'url'}, { label: 'label2', url: 'url2'}]

async function setActivity() {
  var start=new Date();
  start.setTime(start.getTime() + 15e3);
  var activity = {
    details: "details",
    state: "state",
    startTimestamp: new Date(),
    endTimestamp: start,
    largeImageKey: "largeImageKey",
    largeImageText: "largeImageText",
    buttons: buttons,
    instance: false, //or true
  }
  client.clearActivity()
  client.setActivity(activity);
}
client.on('ready', () => {
  console.log('Authed for user', client.user.username);
  setActivity1()
  setInterval(() => {
    setActivity1();
  },15e3); //every 15 seconds
})

rpc.login({clientId: '287406016902594560'}).catch(console.error);```
