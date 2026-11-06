// LOGICIEL TSIFANAVY'S FAMILY — Electron
// Démarre le serveur familial (backend + SQLite) puis affiche l'interface.
const { app, BrowserWindow, shell } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const PORT = 3210;
let serverProcess = null;
let win = null;

// Le module SQLite intégré (node:sqlite) exige Node 22+ récent ;
// on privilégie donc le Node installé sur le PC, sinon le Node d'Electron.
function findSystemNode() {
  const probe = spawnSync('node', ['-e', 'require("node:sqlite")'], { shell: true, encoding: 'utf8' });
  return probe.status === 0 ? 'node' : null;
}

function startServer() {
  const isPackaged = app.isPackaged;
  const backendDir = isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend');

  const runner = findSystemNode();
  const useElectronNode = runner === null;

  const logStream = fs.createWriteStream(path.join(app.getPath('userData'), 'server.log'), { flags: 'a' });
  logStream.write(`\n--- démarrage ${new Date().toISOString()} (runner: ${runner || 'electron-node'}) ---\n`);

  const env = {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: isPackaged ? path.join(app.getPath('userData'), 'data') : process.env.DATA_DIR,
  };
  if (useElectronNode) env.ELECTRON_RUN_AS_NODE = '1';

  serverProcess = spawn(runner || process.execPath, [path.join(backendDir, 'src', 'server.js')], {
    env,
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.pipe(logStream);
  serverProcess.stderr.pipe(logStream);
  serverProcess.on('error', (err) => logStream.write(`serveur: ${err}\n`));
}

function waitForServer(retries = 60) {
  return new Promise((resolve, reject) => {
    const tryOnce = (n) => {
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => { res.resume(); resolve(true); });
      req.on('error', () => {
        if (n <= 0) return reject(new Error('Serveur familial injoignable.'));
        setTimeout(() => tryOnce(n - 1), 500);
      });
    };
    tryOnce(retries);
  });
}

async function createWindow() {
  startServer();
  try {
    await waitForServer();
  } catch (e) {
    console.error(e.message);
  }

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0D1715',
    title: "LOGICIEL TSIFANAVY'S FAMILY",
    autoHideMenuBar: true,
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(`http://127.0.0.1:${PORT}`);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
