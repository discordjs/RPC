## Discord RPC Client ##

```js
const RPCClient = require('discord-rpc').Client;

const client = new RPCClient({
  OAUTH2_CLIENT_ID: 'xyzxyzxyz'
});

client.evts.on('READY', () => {
  console.log('Authenticated!');
  console.log('User:' `${client.user.username}#${client.user.discriminator}`, client.user.id)
  console.log('Application', client.application.name, client.application.id);
  client.request('GET_CHANNELS', {} (err, data) => {
    // data.channels is an array of channels :)
  });
});

client.connect(someAccessToken);
```
