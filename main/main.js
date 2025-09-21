const { app, BrowserWindow, screen, ipcMain, globalShortcut, Notification, Menu, nativeImage } = require('electron');
const path = require('path');
const markdownit = require('markdown-it');
const { getSingleStaff } = require('../db');
require('dotenv').config();

let messageCount = 0;
let conversationID = '';

const { initNotify, sendNotification, scheduleDailyNoonNotification, scheduleDailyCheckoutNotification } = require('./notify');

let petWindow, chatWindow, instachatWindow, infoWindow;
let isPetPaused = false; // 追蹤桌寵暫停狀態
let isContextMenuOpen = false; // 追蹤右鍵選單狀態
let isAnyWindowOpen = false; // 追蹤是否有視窗開啟
let focusWatcher = null; // 焦點監聽器

// 監聽前台應用變化
function startFocusWatcher() {
  if (focusWatcher) return; // 避免重複啟動
  
  // // 只在macOS上啟動焦點監聽
  // if (watchFrontmostApp && process.platform === 'darwin') {
  //   focusWatcher = watchFrontmostApp((appName) => {
  //     console.log('前台應用切換到:', appName);
      
  //     // 如果焦點切到其他應用（非我們的桌寵應用）
  //     if (appName && appName !== 'Electron' && petWindow) {
  //       // 通知渲染進程焦點已切換
  //       petWindow.webContents.send('focus-changed', appName);
        
  //       // 如果是桌面相關程序，額外處理
  //       if (isDesktopProcess && isDesktopProcess(appName)) {
  //         petWindow.webContents.send('desktop-focused');
  //       }
  //     }
  //   });
  // } else {
  //   console.log('Focus watching not available on this platform');
  // }
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
      label: (isPetPaused || isAnyWindowOpen) ? '繼續移動' : '暫停移動',
      click: () => {
        // 選單項目被點擊時立即通知選單關閉
        if (petWindow) {
          petWindow.webContents.send('context-menu-closed');
        }
        
        // 如果有視窗開啟，關閉所有視窗
        if (isAnyWindowOpen) {
          if (chatWindow && chatWindow.isVisible()) {
            chatWindow.hide();
          }
          if (instachatWindow && instachatWindow.isVisible()) {
            instachatWindow.hide();
          }
          // 視窗關閉會自動觸發 updatePetPauseState()
        } else {
          // 沒有視窗開啟，切換永久暫停狀態
          isPetPaused = !isPetPaused;
          // 通知渲染進程切換暫停狀態
          if (petWindow) {
            petWindow.webContents.send('toggle-permanent-pause', isPetPaused);
          }
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
  const windowOptions = {
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
    movable: true, // 允許程式式移動視窗位置
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  };

  // macOS 特定設置
  if (process.platform === 'darwin') {
    windowOptions.acceptFirstMouse = true; // macOS: 允許第一次點擊就啟動
  }

  petWindow = new BrowserWindow(windowOptions);

  // 跨平台兼容：只在macOS上設置 setVisibleOnAllWorkspaces
  if (process.platform === 'darwin') {
    try {
      petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    } catch (error) {
      console.warn('setVisibleOnAllWorkspaces not supported on this platform:', error.message);
    }
  }

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

async function generateQuery(staff, message) {
  if (!staff) return '';

  let query = '';

  if (messageCount == 0) {
    messageCount++;

    query += `My name is ${staff.first_name} ${staff.last_name}, I work in the ${staff.dept_name} department as a ${staff.job_title}. My email is ${staff.email} and my phone number is ${staff.phone}. I was hired on ${staff.hire_date} and my current salary is $${staff.salary}. My employment status is ${staff.status}. Here is my question: `;
  }

  query += `${message}`;
  return query;
}

async function messageToAi(message) {
  let staff = await getSingleStaff('EMP001');
  let query = await generateQuery(staff, message);

  let body = {
    inputs: {},
    response_mode: 'blocking',
    auto_generate_name: true,
    user: 'flabba-pet',
    query: query,
    conversation_id: conversationID
  };

  console.log('Sending message to AI:', message);
  console.log(body);

  // DIFY API call
  return await fetch('https://api.dify.ai/v1/chat-messages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    .catch((error) => {
      console.error('Error during fetch:', error);
    }) 
    .then(response => response.json())
    .then(data => {
      // print the type of data
      const md = markdownit({
        html: true,
        breaks: true,
        linkify: true,
        typographer: true,
      });

      conversationID = data.conversation_id;

      console.log(md.render(data.answer));
      return md.render(data.answer); // Converts markdown to HTML
    });
}

function toggleInfoWindow() {
  if (infoWindow && !infoWindow.isDestroyed()) {
    if (infoWindow.isVisible()) infoWindow.hide();
    else { infoWindow.show(); infoWindow.focus(); }
  } else {
    createInfoWindow();
  }
}

// 直接進入 whenReady
app.whenReady().then(() => {
  createPetWindow();
  createChatWindow();
  createInstachatWindow();

  startFocusWatcher();

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
    // toggleInstachatWindow();
  });
  initNotify(); // 已存在：註冊 renderer 的 notify IPC
  scheduleDailyNoonNotification(); // 新增：排程每天 12:00 通知
  scheduleDailyCheckoutNotification(); // 可選：每天 18:00 通知
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
    try {
      if (ignore) {
        petWindow.setIgnoreMouseEvents(true, { forward: true });
      } else {
        petWindow.setIgnoreMouseEvents(false);
        // Windows平台可能需要額外的焦點處理
        if (process.platform === 'win32') {
          setTimeout(() => {
            if (petWindow && !petWindow.isDestroyed()) {
              petWindow.focus();
            }
          }, 10);
        } else {
          petWindow.focus();
        }
      }
    } catch (error) {
      console.error('Mouse event handling error:', error);
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
  
  try {
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
  } catch (error) {
    console.error('Context menu error:', error);
    // 如果選單顯示失敗，重置狀態
    isContextMenuOpen = false;
    updatePetPauseState();
  }
});

ipcMain.handle('notify', (_event, payload) => {
  try {
    return sendNotification(payload);
  } catch (err) {
    console.error('發送通知失敗:', err);
    return false;
  }
});

// 新增：AI 聊天處理
ipcMain.handle('message-to-ai', async (_event, message) => {
  try {
    return await messageToAi(message);
  } catch (error) {
    console.error('AI 聊天錯誤:', error);
    return '抱歉，發生了錯誤。請稍後再試。';
  }
});
