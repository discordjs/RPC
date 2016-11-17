## Discord RPC Client ##

A simple RPC client for Discord somewhat stolen from the Discord StreamKit.

For the latest changes install via `guscaplan/discord-rpc`

This client is fully tested with browserify, and should work with webpack. It can also be used with regular node apps.

```js
const RPCClient = require('discord-rpc').Client;

const client = new RPCClient({
  OAUTH2_CLIENT_ID: 'xyzxyzxyz'
});

client.evts.on('READY', () => {
  console.log('Authenticated!');
  console.log('User:' `${client.user.username}#${client.user.discriminator}`, client.user.id)
  console.log('Application:', client.application.name, client.application.id);
  client.request('GET_CHANNELS', {}, (err, data) => {
    // data.channels is an array of channels :)
  });

  // if you are so lucky as to have the rpc.api scope, you can have a little fun
  client.rest.sendMessage('some channel id', 'hello, how are you?');
});

client.connect(someAccessToken);
```
