let isPetPaused = false; // 追蹤桌寵暫停狀態
let isContextMenuOpen = false; // 追蹤右鍵選單狀態
let focusWatcher = null; // 焦點監聽器

// 更新桌寵暫停狀態
function updatePetPauseState() {
  const { getPetWindow, getIsAnyWindowOpen } = require('./windowManager');
  const shouldPause = isPetPaused || isContextMenuOpen || getIsAnyWindowOpen();
  const petWindow = getPetWindow();
  
  if (petWindow) {
    petWindow.webContents.send('update-pause-state', shouldPause);
  }
}

// 監聽前台應用變化
function startFocusWatcher() {
  if (focusWatcher) return; // 避免重複啟動
  
  // 嘗試引入 macOS 焦點監聽功能（如果存在）
  let watchFrontmostApp = null;
  let isDesktopProcess = null;
  try {
    if (process.platform === 'darwin') {
      const macFrontmost = require('../macFrontmost');
      watchFrontmostApp = macFrontmost.watchFrontmostApp;
      isDesktopProcess = macFrontmost.isDesktopProcess;
    }
  } catch (error) {
    console.log('macFrontmost module not available:', error.message);
  }
  
  // 只在macOS上啟動焦點監聽
  if (watchFrontmostApp && process.platform === 'darwin') {
    const { getPetWindow } = require('./windowManager');
    focusWatcher = watchFrontmostApp((appName) => {
      console.log('前台應用切換到:', appName);
      
      const petWindow = getPetWindow();
      // 如果焦點切到其他應用（非我們的桌寵應用）
      if (appName && appName !== 'Electron' && petWindow) {
        // 通知渲染進程焦點已切換
        petWindow.webContents.send('focus-changed', appName);
        
        // 如果是桌面相關程序，額外處理
        if (isDesktopProcess && isDesktopProcess(appName)) {
          petWindow.webContents.send('desktop-focused');
        }
      }
    });
  } else {
    console.log('Focus watching not available on this platform');
  }
}

module.exports = {
  // 狀態 getters/setters
  getIsPetPaused: () => isPetPaused,
  setIsPetPaused: (value) => { isPetPaused = value; },
  
  getIsContextMenuOpen: () => isContextMenuOpen,
  setIsContextMenuOpen: (value) => { isContextMenuOpen = value; },
  
  getFocusWatcher: () => focusWatcher,
  setFocusWatcher: (value) => { focusWatcher = value; },
  
  // 函數
  updatePetPauseState,
  startFocusWatcher
};