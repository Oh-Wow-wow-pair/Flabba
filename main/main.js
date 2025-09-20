const { app, BrowserWindow, screen, ipcMain, globalShortcut, Notification, Menu, nativeImage } = require('electron');
const path = require('path');
const { watchFrontmostApp, isDesktopProcess } = require('./macFrontmost');
const { time } = require('console');

let petWindow, chatWindow, instachatWindow, infoWindow;
let isPetPaused = false; // 追蹤桌寵暫停狀態
let isContextMenuOpen = false; // 追蹤右鍵選單狀態
let isAnyWindowOpen = false; // 追蹤是否有視窗開啟
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
      label: '開啟 chatWindow',
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
    {
      label: '開啟 instachatWindow',
      click: () => {
        // 選單項目被點擊時立即通知選單關閉
        if (petWindow) {
          petWindow.webContents.send('context-menu-closed');
        }
        toggleInstachatWindow();
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

// 更新桌寵暫停狀態
function updatePetPauseState() {
  const shouldPause = isPetPaused || isContextMenuOpen || isAnyWindowOpen;
  if (petWindow) {
    petWindow.webContents.send('update-pause-state', shouldPause);
  }
}

// 更新 instachatWindow 位置跟隨桌寵
function updateInstachatPosition() {
  if (instachatWindow && !instachatWindow.isDestroyed() && instachatWindow.isVisible() && petWindow) {
    const [petX, petY] = petWindow.getPosition();
    instachatWindow.setPosition(petX + 128, petY, false);
  }
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
    movable: true, // 允許程式式移動視窗位置
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
    
    // 更新 instachatWindow 位置跟隨桌寵
    updateInstachatPosition();
  });
  
  // 啟動時強制獲得焦點
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

  chatWindow.on('show', () => {
    // 隱藏 instachatWindow
    if (instachatWindow && instachatWindow.isVisible()) {
      instachatWindow.hide();
    }
    isAnyWindowOpen = true;
    updatePetPauseState();
  });
  
  chatWindow.on('focus', () => {
    // 隱藏 instachatWindow
    if (instachatWindow && instachatWindow.isVisible()) {
      instachatWindow.hide();
    }
  });

  chatWindow.on('close', (event) => {
    event.preventDefault();
    chatWindow.hide();
  });
  
  chatWindow.on('hide', () => {
    isAnyWindowOpen = false;
    updatePetPauseState();
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
  
  instachatWindow.on('show', () => {
    // 隱藏 chatWindow
    if (chatWindow && chatWindow.isVisible()) {
      chatWindow.hide();
    }
    isAnyWindowOpen = true;
    updatePetPauseState();
  });
  
  instachatWindow.on('hide', () => {
    isAnyWindowOpen = false;
    updatePetPauseState();
  });
}

function toggleInstachatWindow() {
  if (!instachatWindow || instachatWindow.isDestroyed()) return;
  
  if (instachatWindow.isVisible()) {
    if (instachatWindow.isFocused()) {
      instachatWindow.hide();
    } else {
      instachatWindow.focus();
    }
  } else {
    // 隱藏 chatWindow
    if (chatWindow && chatWindow.isVisible()) {
      chatWindow.hide();
    }
    
    // 設置位置在桌寵右上角
    if (petWindow) {
      const [petX, petY] = petWindow.getPosition();
      instachatWindow.setPosition(petX + 128, petY, false); // 128是桌寵窗口寬度
    }
    
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
    if (chatWindow.isFocused()) {
      chatWindow.hide();
    } else {
      chatWindow.focus();
    }
  } else {
    // 隱藏 instachatWindow
    if (instachatWindow && instachatWindow.isVisible()) {
      instachatWindow.hide();
    }
    
    // 設置位置在螢幕中心
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
    const windowWidth = 650;
    const windowHeight = 700;
    const centerX = Math.round((screenWidth - windowWidth) / 2);
    const centerY = Math.round((screenHeight - windowHeight) / 2);
    
    chatWindow.setPosition(centerX, centerY, false);
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

function sendNotification({ title, body, silent, icon } = {}) {
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title: title || 'Flabba',
    body: body || '',
    silent: !!silent,
    icon: process.platform === 'darwin' ? undefined : resolveIcon(icon)
  });
  n.show();
  return true;
}

// 每日 12:00 通知排程
function scheduleDailyNoonNotification() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(12, 0, 0, 0);              // 今日 12:00
  if (target <= now) target.setDate(target.getDate() + 1); // 已過就排到明天

  const delay = target - now;
  setTimeout(() => {
    sendNotification({ title: '午間提醒', body: '現在是中午 12:00，記得用餐或休息。' });
    // 之後每天固定時間再提醒
    setInterval(() => {
      sendNotification({ title: '午間提醒', body: '現在是中午 12:00，記得用餐或休息。' });
    }, 24 * 60 * 60 * 1000);
  }, delay);
}

function weatherCodeToText(code) {
  if (code === 0) return '晴朗';
  if ([1,2,3].includes(code)) return '多雲';
  if ([45,48].includes(code)) return '霧';
  if ([51,53,55].includes(code)) return '毛毛雨';
  if ([61,63,65].includes(code)) return '雨';
  if ([66,67].includes(code)) return '凍雨';
  if ([71,73,75,77].includes(code)) return '雪';
  if ([80,81,82].includes(code)) return '陣雨';
  if (code === 95) return '雷雨';
  if ([96,99].includes(code)) return '雷雨冰雹';
  return '天氣';
}

async function fetchHsinchuWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=24.8138&longitude=120.9675'
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code'
      + '&timezone=Asia%2FTaipei';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cur = data.current;
    const text = `新竹 ${Math.round(cur.temperature_2m)}°C ${weatherCodeToText(cur.weather_code)} 濕度${cur.relative_humidity_2m}% 風${cur.wind_speed_10m}m/s`;
    return text; // 回傳給通知組字用
  } catch (e) {
    console.warn('weather error', e);
    return null; // 失敗時回傳 null
  }
}

function scheduleDailyCheckoutNotification(){
  const now = new Date();
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);              // 今日 18:00
  if (target <= now) target.setDate(target.getDate() + 1); // 已過就排到明天

  const delay = target - now;
  fetchHsinchuWeather();
  setInterval(fetchHsinchuWeather, 30 * 60 * 1000);
  setTimeout(() => {
    (async () => {
      const w = await fetchHsinchuWeather();
      const body = w
        ? `現在是晚上 18:00，該準備下班了！\n${w}`
        : '現在是晚上 18:00，該準備下班了！';
      sendNotification({ title: '該下班囉～', body });
    })();

    // 之後每天固定時間再提醒
    setInterval(() => {
      (async () => {
        const w = await fetchHsinchuWeather();
        const body = w
          ? `現在是晚上 18:00，該準備下班了！\n${w}`
          : '現在是晚上 18:00，該準備下班了！';
        sendNotification({ title: '該下班囉～', body });
      })();
    }, 24 * 60 * 60 * 1000);
  }, delay);
};

app.whenReady().then(() => {
  createPetWindow();
  createChatWindow();
  createInstachatWindow();

  // 啟動焦點監聽器
  startFocusWatcher();

  // 若啟動瞬間剛好是 12:00，立刻提醒一次
  const now = new Date();
  if (now.getHours() === 12 && now.getMinutes() === 0) {
    sendNotification({ title: '午間提醒', body: '現在是中午 12:00，記得用餐或休息。' });
  }

  // 排程每天 12:00 提醒
  scheduleDailyNoonNotification();
  scheduleDailyCheckoutNotification();

  // ESC：讓寵物視窗暫時可互動並重置拖拽狀態
  globalShortcut.register('Escape', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show();
      petWindow.setIgnoreMouseEvents(false); // 重置滑鼠穿透，讓前端控制
      
      // 發送訊息給前端重置拖拽狀態
      petWindow.webContents.send('reset-drag-state');
      
      // 移除強制設置穿透的邏輯，讓前端的 mouseenter/mouseleave 控制
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
  if (petWindow) {
    petWindow.setPosition(Math.round(x), Math.round(y), false);
    // 立即更新 instachatWindow 位置
    updateInstachatPosition();
  }
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
    // 隱藏 chatWindow
    if (chatWindow && chatWindow.isVisible()) {
      chatWindow.hide();
    }
    
    const [petX, petY] = petWindow.getPosition();
    instachatWindow.setPosition(petX + 128, petY, false); // 統一使用128
    
    if (!instachatWindow.isVisible()) {
      instachatWindow.show();
    } else {
      instachatWindow.focus();
    }
  }
});

// 顯示原生右鍵選單
ipcMain.handle('show-context-menu', (event) => {
  isContextMenuOpen = true;
  updatePetPauseState(); // 選單開啟時暫停桌寵
  
  const menu = createContextMenu();
  menu.popup({ 
    window: petWindow,
    callback: () => {
      // 選單關閉時通知渲染進程並恢復桌寵狀態
      isContextMenuOpen = false;
      updatePetPauseState();
      
      if (petWindow) {
        petWindow.webContents.send('context-menu-closed');
      }
    }
  });
});

ipcMain.handle('notify', (_event, payload) => {
  try {
    return sendNotification(payload);
  } catch (err) {
    console.error('發送通知失敗:', err);
    return false;
  }
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
  globalShortcut.unregisterAll();
  
  // 停止焦點監聽
  if (focusWatcher) {
    focusWatcher();
    focusWatcher = null;
  }
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
