
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let petWindow, chatWindow;

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 256,
    height: 256,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false, // 讓桌寵不會覆蓋其他應用程式
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true
    }
  });
  
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.loadFile(path.join(__dirname, '../renderer/pet/index.html'));
  petWindow.setIgnoreMouseEvents(true, { forward: true });
}

function createChatWindow() {
  chatWindow = new BrowserWindow({
    width: 380,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true
    }
  });
  chatWindow.loadFile(path.join(__dirname, '../renderer/chat/index.html'));
}

function toggleChatWindow() {
  if (!chatWindow || !petWindow) return;
  if (chatWindow.isVisible()) {
    chatWindow.hide();
  } else {
    const [x, y] = petWindow.getPosition();
    chatWindow.setPosition(x + 140, y);
    chatWindow.show();
    chatWindow.focus();
  }
}

app.whenReady().then(() => {
  createPetWindow();
  createChatWindow();
});

// IPC handlers
ipcMain.handle('get-displays', () => {
  const displays = screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    workArea: d.workArea
  }));
  return { primary: screen.getPrimaryDisplay().id, displays };
});

ipcMain.handle('move-window', (_e, { x, y }) => {
  if (petWindow) petWindow.setPosition(Math.round(x), Math.round(y), false);
});

ipcMain.handle('toggle-mouse-through', (_e, ignore) => {
  if (petWindow) petWindow.setIgnoreMouseEvents(!!ignore, { forward: true });
});

ipcMain.handle('toggle-chat', () => toggleChatWindow());

// Keep app alive even if windows are hidden (typical for tray apps)
// Do not quit on macOS when all windows closed
app.on('window-all-closed', () => {
  // no-op to keep the pet running
});

app.on('activate', () => {
  if (!petWindow) createPetWindow();
});

// Helpful: log any unhandled rejections so the app doesn't crash silently
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
