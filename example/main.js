/* eslint-disable no-console */

const { app, BrowserWindow, ipcMain: ipc } = require('electron');
const path = require('path');
const url = require('url');

const DiscordRPC = require('../');

let mainWindow;
let rpcClient;

const hash = (d) => crypto.createHash('md5').update(d).digest('hex');

ipc.on('ready', () => {
  if (rpcClient)
    return;

  rpcClient = new DiscordRPC.Client({ transport: 'ipc' });

  rpcClient.login('180984871685062656')
    .then(() => {
      console.log('rpc client ready!');

      rpcClient.setActivity({
        state: 'using discord-rpc',
        details: 'js is pretty cool',
        startTimestamp: Date.now(),
        endTimestamp: Date.now() + (5 * 60e3),
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
      }).then((activity) => {
        console.log(activity);
        if (mainWindow)
          mainWindow.webContents.send('activity', activity);
      }, console.error);
    }, console.error);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    name: 'Rich Presence Example',
  });

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
  }));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (rpcClient) {
      rpcClient.destroy();
      rpcClient = null;
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit();
});

app.on('activate', () => {
  if (mainWindow === null)
    createWindow();
});
