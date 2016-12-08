## Discord RPC Client ##

[![npm](https://img.shields.io/npm/v/discord-rpc.svg?maxAge=3600)](https://www.npmjs.com/package/discord-rpc)
[![npm](https://img.shields.io/npm/dt/discord-rpc.svg?maxAge=3600)](https://www.npmjs.com/package/discord-rpc)
[![David](https://david-dm.org/guscaplan/discord-rpc.svg)](https://david-dm.org/guscaplan/discord-rpc)

[![NPM](https://nodei.co/npm/discord-rpc.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/discord-rpc/)

A simple RPC client for Discord somewhat stolen from the Discord StreamKit.

For the latest changes install via `guscaplan/discord-rpc`

This client is fully tested with browserify and webpack. It can also be used with regular node apps.

Webpack builds of the beautiful and ugly kind are in `/webpack`

```js
// NODE
const RPCClient = require('discord-rpc').Client;
// BROWSER
const RPCClient = window.DiscordRPC.Client;

const client = new RPCClient({
  OAUTH2_CLIENT_ID: 'xyzxyzxyz'
});

client.on('ready', () => {
  console.log('Authenticated!');
  console.log('User:' `${client.user.username}#${client.user.discriminator}`, client.user.id)
  console.log('Application:', client.application.name, client.application.id);
  client.getChannels().then(res => {
    // res is an array of channels :)
  });

  client.selectVoiceChannel('1234567890').then(channel => {
    console.log('the voice channel was set to', channel.id);
  })

  // if you are so lucky as to have the rpc.api scope, you can have a little fun
  client.rest.sendMessage('some channel id', 'hello, how are you?');
});

client.connect(someAccessToken);
```
