const { BrowserWindow, screen } = require('electron');
const path = require('path');

let petWindow, chatWindow, instachatWindow, infoWindow;
let isAnyWindowOpen = false;

// 更新 instachatWindow 位置跟隨桌寵
function updateInstachatPosition() {
  if (instachatWindow && !instachatWindow.isDestroyed() && instachatWindow.isVisible() && petWindow) {
    const [petX, petY] = petWindow.getPosition();
    instachatWindow.setPosition(petX + 128, petY, false);
  }
}

// 檢查並更新是否有視窗開啟的狀態
function updateAnyWindowOpenState() {
  const chatVisible = chatWindow && chatWindow.isVisible();
  const instachatVisible = instachatWindow && instachatWindow.isVisible();
  isAnyWindowOpen = chatVisible || instachatVisible;
  
  // 這裡需要從 stateManager 導入 updatePetPauseState
  const { updatePetPauseState } = require('./stateManager');
  updatePetPauseState();
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
    alwaysOnTop: false,     // 設置為不置頂，避免遮擋其他應用程式
    hasShadow: false,
    skipTaskbar: true,
    focusable: true,
    movable: true, // 允許程式式移動視窗位置
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload.js'),
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

  petWindow.loadFile(path.join(__dirname, '../../renderer/pet/index.html'));
  
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
      preload: path.join(__dirname, '../../preload/preload.js'),
      contextIsolation: true
    }
  });
  chatWindow.loadFile(path.join(__dirname, '../../renderer/chat/index.html'));

  chatWindow.on('show', () => {
    // 隱藏 instachatWindow
    if (instachatWindow && instachatWindow.isVisible()) {
      instachatWindow.hide();
    }
    updateAnyWindowOpenState();
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
    updateAnyWindowOpenState();
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
    alwaysOnTop: false,      // 設置為不置頂，避免遮擋桌寵
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload.js'),
      contextIsolation: true
    }
  });
  instachatWindow.loadFile(path.join(__dirname, '../../renderer/instachat/index.html'));
  instachatWindow.hide();
  
  instachatWindow.on('show', () => {
    // 隱藏 chatWindow
    if (chatWindow && chatWindow.isVisible()) {
      chatWindow.hide();
    }
    updateAnyWindowOpenState();
  });
  
  instachatWindow.on('hide', () => {
    updateAnyWindowOpenState();
  });
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
      preload: path.join(__dirname, '../../preload/preload.js'),
      contextIsolation: true
    }
  });
  infoWindow.loadFile(path.join(__dirname, '../../renderer/info/index.html'));
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

function toggleInfoWindow() {
  if (infoWindow && !infoWindow.isDestroyed()) {
    if (infoWindow.isVisible()) infoWindow.hide();
    else { infoWindow.show(); infoWindow.focus(); }
  } else {
    createInfoWindow();
  }
}

module.exports = {
  // 窗口引用
  getPetWindow: () => petWindow,
  getChatWindow: () => chatWindow,
  getInstachatWindow: () => instachatWindow,
  getInfoWindow: () => infoWindow,
  
  // 狀態
  getIsAnyWindowOpen: () => isAnyWindowOpen,
  setIsAnyWindowOpen: (value) => { isAnyWindowOpen = value; },
  
  // 窗口創建函數
  createPetWindow,
  createChatWindow,
  createInstachatWindow,
  createInfoWindow,
  
  // 窗口切換函數
  toggleChatWindow,
  toggleInstachatWindow,
  toggleInfoWindow,
  
  // 工具函數
  updateInstachatPosition,
  updateAnyWindowOpenState
};