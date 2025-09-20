const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');

let petWindow, chatWindow, infoWindow, instachatWindow;

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 128,
    height: 128,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: true,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });

  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.loadFile(path.join(__dirname, '../renderer/pet/index.html'));

  petWindow.once('ready-to-show', () => {
    petWindow.show();
    petWindow.focus();
  });
}

function createChatWindow() {
  chatWindow = new BrowserWindow({
    width: 650,
    height: 700,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true
    }
  });
  chatWindow.loadFile(path.join(__dirname, '../renderer/chat/index.html'));

  chatWindow.on('close', (event) => {
    event.preventDefault();
    chatWindow.hide();
  });
}

function createInstachatWindow() {
  instachatWindow = new BrowserWindow({
    width: 300,
    height: 200,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true
    }
  });
  instachatWindow.loadFile(path.join(__dirname, '../renderer/instachat/index.html'));
  instachatWindow.hide();
}

function toggleInstachatWindow() {
  if (!instachatWindow || instachatWindow.isDestroyed()) return;
  if (instachatWindow.isVisible()) {
    if (instachatWindow.isFocused()) instachatWindow.hide();
    else instachatWindow.focus();
  } else {
    instachatWindow.show();
  }
}

function createInfoWindow() {
  if (infoWindow && !infoWindow.isDestroyed()) {
    infoWindow.show();
    infoWindow.focus();
    return;
  }
  infoWindow = new BrowserWindow({
    width: 460,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true
    }
  });
  infoWindow.loadFile(path.join(__dirname, '../renderer/info/index.html'));
  infoWindow.once('ready-to-show', () => {
    infoWindow.show();
    infoWindow.focus();
  });
  infoWindow.on('closed', () => { infoWindow = null; });
}

function toggleChatWindow() {
  if (!chatWindow || chatWindow.isDestroyed()) return;
  if (chatWindow.isVisible()) {
    if (chatWindow.isFocused()) chatWindow.hide();
    else chatWindow.focus();
  } else {
    chatWindow.show();
  }
}

function toggleInfoWindow() {
  if (infoWindow && !infoWindow.isDestroyed()) {
    if (infoWindow.isVisible()) infoWindow.hide();
    else { infoWindow.show(); infoWindow.focus(); }
  } else {
    createInfoWindow();
  }
}

app.whenReady().then(() => {
  createPetWindow();
  createChatWindow();
  createInstachatWindow(); // 需要時再顯示

  // ESC：讓寵物視窗暫時可互動並重置拖拽狀態
  globalShortcut.register('Escape', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show();
      petWindow.focus();
      petWindow.setIgnoreMouseEvents(false);
      petWindow.webContents.send('reset-drag-state');
      setTimeout(() => {
        petWindow.setIgnoreMouseEvents(true, { forward: true });
      }, 1000);
    }
  });

  // Cmd/Ctrl+Shift+L：切換請假介面（info）
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    toggleInfoWindow();
  });

  // Alt+P：切換聊天視窗
  globalShortcut.register('Alt+P', () => {
    toggleChatWindow();
    // 如需一起切換 instachat，可打開下一行：
    // toggleInstachatWindow();
  });
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

ipcMain.handle('get-current-position', () => {
  if (petWindow) {
    const [x, y] = petWindow.getPosition();
    return { x, y };
  }
  return { x: 0, y: 0 };
});

ipcMain.handle('toggle-mouse-through', (_e, ignore) => {
  if (petWindow) {
    if (ignore) {
      petWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      petWindow.setIgnoreMouseEvents(false);
      petWindow.focus();
    }
  }
});

ipcMain.handle('refocus-window', () => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.focus();
    petWindow.show();
    return true;
  }
  return false;
});

ipcMain.handle('reset-window-state', () => {
  if (petWindow && process.platform === 'darwin') {
    petWindow.setAlwaysOnTop(false);
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    setTimeout(() => {
      petWindow.setIgnoreMouseEvents(true, { forward: true });
    }, 100);
  }
});

ipcMain.handle('toggle-chat', () => toggleChatWindow());

ipcMain.handle('show-instachat-at-pet', () => {
  if (petWindow && instachatWindow) {
    const [petX, petY] = petWindow.getPosition();
    instachatWindow.setPosition(petX + 130, petY, false);
    toggleInstachatWindow();
  }
});

// keep running like a tray app
app.on('window-all-closed', () => { /* no-op */ });

app.on('activate', () => {
  if (!petWindow) createPetWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
