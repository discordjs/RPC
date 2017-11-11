/* eslint-disable no-console */

const DiscordRPC = require('../src');

const client = new DiscordRPC.Client({
  transport: 'ipc',
});

client.on('ready', () => {
  console.log('Logged in as', client.application.name);
  console.log('Authed for user', client.user.tag);
  client.getChannel('188767514824671233').then(console.log, console.error);
});

client.login('207646673902501888', {
  scopes: ['rpc', 'rpc.api', 'messages.read'],
  tokenEndpoint: 'https://streamkit.discordapp.com/overlay/token',
});
