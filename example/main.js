'use strict';

/* eslint-disable no-console */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const DiscordRPC = require('../');

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
  if (mainWindow === null) {
    createWindow();
  }
});

// don't change the client id if you want this example to work
const clientId = '180984871685062656';

// only needed for discord allowing spectate, join, ask to join
DiscordRPC.register(clientId);

const rpc = new DiscordRPC.Client({ transport: 'ipc' });
const startTimestamp = new Date();

async function setActivity() {
  if (!rpc || !mainWindow) {
    return;
  }

  const boops = await mainWindow.webContents.executeJavaScript('window.boops');

  rpc.setActivity({
    details: `booped ${boops} times`,
    state: 'in slither party',
    startTimestamp,
    largeImageKey: 'snek_large',
    largeImageText: 'tea is delicious',
    smallImageKey: 'snek_small',
    smallImageText: 'i am my own pillows',
    instance: false,
  });
}

rpc.on('ready', () => {
  setActivity();

  // activity can only be set every 15 seconds
  setInterval(() => {
    setActivity();
  }, 15e3);
});

rpc.login({ clientId }).catch(console.error);
