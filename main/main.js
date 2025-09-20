
const { app, BrowserWindow, screen, ipcMain, globalShortcut, Menu } = require('electron');
const path = require('path');
const { watchFrontmostApp, isDesktopProcess } = require('./macFrontmost');

let petWindow, chatWindow, instachatWindow;
let isPetPaused = false; // 追蹤桌寵暫停狀態
let focusWatcher = null; // 焦點監聽器

// 監聽前台應用變化
function startFocusWatcher() {
  if (focusWatcher) return; // 避免重複啟動
  
  focusWatcher = watchFrontmostApp((appName) => {
    console.log('前台應用切換到:', appName);
    
    // 如果焦點切到其他應用（非我們的桌寵應用）
    if (appName && appName !== 'Electron' && petWindow) {
      // 通知渲染進程焦點已切換
      petWindow.webContents.send('focus-changed', appName);
      
      // 如果是桌面相關程序，額外處理
      if (isDesktopProcess(appName)) {
        petWindow.webContents.send('desktop-focused');
      }
    }
  }, 300); // 每300ms檢查一次
}

// 創建右鍵選單
function createContextMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '開啟對話框',
      click: () => {
        // 選單項目被點擊時立即通知選單關閉
        if (petWindow) {
          petWindow.webContents.send('context-menu-closed');
        }
        toggleChatWindow();
        // 通知渲染進程執行bounce動畫
        if (petWindow) {
          petWindow.webContents.send('pet-bounce');
        }
      }
    },
    { type: 'separator' },
    {
      label: isPetPaused ? '開始移動' : '暫停移動',
      click: () => {
        // 選單項目被點擊時立即通知選單關閉
        if (petWindow) {
          petWindow.webContents.send('context-menu-closed');
        }
        isPetPaused = !isPetPaused;
        // 通知渲染進程切換暫停狀態
        if (petWindow) {
          petWindow.webContents.send('toggle-permanent-pause', isPetPaused);
        }
      }
    }
  ]);
  return contextMenu;
}

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
    acceptFirstMouse: true, // macOS: 允許第一次點擊就啟動
    movable: false, // 防止被系統移動
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.loadFile(path.join(__dirname, '../renderer/pet/index.html'));
  
  // 監聽視窗位置變化，防止被系統移動到螢幕外
  petWindow.on('move', () => {
    const [x, y] = petWindow.getPosition();
    const displays = screen.getAllDisplays();
    let isOnScreen = false;
    
    // 檢查視窗是否在任何螢幕上
    for (const display of displays) {
      const { x: dx, y: dy, width: dw, height: dh } = display.bounds;
      if (x >= dx - 100 && x <= dx + dw - 28 && y >= dy - 100 && y <= dy + dh - 28) {
        isOnScreen = true;
        break;
      }
    }
    
    // 如果不在螢幕上，移回安全位置
    if (!isOnScreen) {
      const primaryDisplay = screen.getPrimaryDisplay();
      const safeX = Math.max(50, Math.min(x, primaryDisplay.bounds.width - 178));
      const safeY = Math.max(50, Math.min(y, primaryDisplay.bounds.height - 178));
      petWindow.setPosition(safeX, safeY, false);
      console.log(`桌寵被移回安全位置: (${safeX}, ${safeY})`);
    }
  });
  
  // 啟動時強制獲得焦點
  petWindow.once('ready-to-show', () => {
    petWindow.show();
    petWindow.focus();
  });
  
  // 移除自動重新獲得焦點的邏輯，改為提供手動方式
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
  if (instachatWindow.isVisible()) {
    if (instachatWindow.isFocused()) {
      instachatWindow.hide();
    }
    else {
      instachatWindow.focus();
    }
  }
  else {
    instachatWindow.show();
  }
}

function toggleChatWindow() {
  if (chatWindow.isVisible()) {
    if (chatWindow.isFocused()) {
      chatWindow.hide();
    }
    else {
      chatWindow.focus();
    }
  }
  else {
    chatWindow.show();
  }
}

app.whenReady().then(() => {
  createPetWindow();
  createChatWindow();
  createInstachatWindow();
  
  // 啟動焦點監聽器
  startFocusWatcher();

  // 註冊全域快捷鍵：Esc 來重新啟動桌寵焦點
  globalShortcut.register('Escape', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show();
      petWindow.setIgnoreMouseEvents(false); // 重置滑鼠穿透，讓前端控制
      
      // 發送訊息給前端重置拖拽狀態
      petWindow.webContents.send('reset-drag-state');
      
      // 移除強制設置穿透的邏輯，讓前端的 mouseenter/mouseleave 控制
    }
  });

  globalShortcut.register('Alt+P', () => {
    toggleChatWindow();
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

// 新增：強制重置滑鼠狀態
ipcMain.handle('force-reset-mouse-state', () => {
  if (petWindow) {
    console.log('強制重置滑鼠狀態');
    petWindow.setIgnoreMouseEvents(false); // 重置為可接收事件
    // 不設置超時，讓前端的 mouseenter/mouseleave 控制
  }
});

ipcMain.handle('toggle-mouse-through', (_e, ignore) => {
  if (petWindow) {
    if (ignore) {
      // 啟用滑鼠穿透 - 立即設置，不等待
      petWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      // 禁用滑鼠穿透 - 立即設置
      petWindow.setIgnoreMouseEvents(false);
      petWindow.focus(); // 確保視窗獲得焦點
    }
  }
});

// 新增：手動重新獲得焦點的方法
ipcMain.handle('refocus-window', () => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.focus();
    petWindow.show(); // 確保視窗可見
    return true;
  }
  return false;
});

// 新增：重置視窗狀態的 IPC handler
ipcMain.handle('reset-window-state', () => {
  if (petWindow && process.platform === 'darwin') {
    // 強制重新建立視窗的滑鼠事件狀態
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

// 顯示原生右鍵選單
ipcMain.handle('show-context-menu', (event) => {
  const menu = createContextMenu();
  menu.popup({ 
    window: petWindow,
    callback: () => {
      // 選單關閉時通知渲染進程
      if (petWindow) {
        petWindow.webContents.send('context-menu-closed');
      }
    }
  });
});

// Keep app alive even if windows are hidden (typical for tray apps)
// Do not quit on macOS when all windows closed
app.on('window-all-closed', () => {
  // no-op to keep the pet running
});

app.on('activate', () => {
  if (!petWindow) createPetWindow();
});

app.on('will-quit', () => {
  // 清理全域快捷鍵
  globalShortcut.unregisterAll();
  
  // 停止焦點監聽
  if (focusWatcher) {
    focusWatcher();
    focusWatcher = null;
  }
});

// Helpful: log any unhandled rejections so the app doesn't crash silently
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
