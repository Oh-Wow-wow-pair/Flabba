const { app, globalShortcut } = require('electron');
const { initNotify, scheduleDailyNoonNotification, scheduleDailyCheckoutNotification } = require('./notify');

// 導入模組
const { 
  createPetWindow, 
  createChatWindow, 
  createInstachatWindow, 
  toggleChatWindow, 
  toggleInfoWindow,
  getPetWindow
} = require('./modules/windowManager');

const { 
  startFocusWatcher 
} = require('./modules/stateManager');

const { 
  setupIpcHandlers 
} = require('./modules/ipcHandlers');

// 當應用準備就緒時
app.whenReady().then(() => {
  // 創建所有窗口
  createPetWindow();
  createChatWindow();
  createInstachatWindow();

  // 開始焦點監控
  startFocusWatcher();
  
  // 設置 IPC 處理器
  setupIpcHandlers();

  // 設置全局快捷鍵
  // ESC：讓寵物視窗暫時可互動並重置拖拽狀態
  globalShortcut.register('Escape', () => {
    const petWindow = getPetWindow();
    
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show();
      petWindow.setIgnoreMouseEvents(false);
      petWindow.webContents.send('reset-drag-state');
    }
  });

  // Cmd/Ctrl+Shift+L：切換請假介面（info）
  globalShortcut.register('CommandOrControl+Shift+L', () => {
    toggleInfoWindow();
  });

  // Cmd/Ctrl+Shift+C：切換聊天視窗
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    toggleChatWindow();
  });

  // 初始化通知系統
  initNotify();
  scheduleDailyNoonNotification();
  scheduleDailyCheckoutNotification();
});

// 當所有窗口關閉時
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 當應用被激活時
app.on('activate', () => {
  const petWindow = getPetWindow();
  if (!petWindow || petWindow.isDestroyed()) {
    createPetWindow();
  }
});

// 應用退出前清理
app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});