/* eslint-disable no-console */

const { app, BrowserWindow, ipcMain: ipc } = require('electron');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const DiscordRPC = require('../');

// "secure" :/
const hash = (d) => crypto.createHash('md5').update(d).digest('hex');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 380,
    resizable: false,
    titleBarStyle: 'hidden',
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
  }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null)
    createWindow();
});

const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let boops = 0;
const startTimestamp = new Date();

function setActivity() {
  if (!rpc)
    return;

  rpc.setActivity({
    details: `booped ${boops} times`,
    state: 'in slither party',
    startTimestamp,
    largeImageKey: 'snek_large',
    largeImageText: 'tea is delicious',
    smallImageKey: 'snek_small',
    smallImageText: 'i am my own pillows',
    partyId: 'snek_party',
    partySize: 1,
    partyMax: 1,
    matchSecret: hash('match'),
    joinSecret: hash('join'),
    spectateSecret: hash('spectate'),
    instance: true,
  });
}

rpc.on('ready', () => {
  setActivity();

  // activity can only be set every 15 seconds
  setInterval(() => {
    setActivity();
  }, 15e3);
});

// don't change the client id if you want this example to work
rpc.login('180984871685062656').catch(console.error);

ipc.on('boop', (evt, { boops: b }) => {
  boops = b;
});
