const { app, BrowserWindow, protocol, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

protocol.registerSchemesAsPrivileged([
  { scheme: 'budget', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function registerAppProtocol() {
  const webRoot = path.resolve(app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'web'));
  const rootPrefix = `${webRoot}${path.sep}`.toLowerCase();

  protocol.handle('budget', async (request) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const filePath = path.resolve(webRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (filePath.toLowerCase() !== webRoot.toLowerCase() && !filePath.toLowerCase().startsWith(rootPrefix)) {
      return new Response('Forbidden', { status: 403 });
    }

    let content;
    try {
      content = await fs.readFile(filePath);
    } catch {
      return new Response('Not found', { status: 404 });
    }

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self' budget:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}

async function createWindow() {
  registerAppProtocol();
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f5f7f4',
    title: 'Budget familial',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('budget://app/')) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL('budget://app/');
}

app.whenReady().then(createWindow).catch((error) => {
  console.error('Unable to start the budget application:', error);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
