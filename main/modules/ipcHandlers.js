const { ipcMain, screen } = require('electron');

function setupIpcHandlers() {
  const { getPetWindow, updateInstachatPosition } = require('./windowManager');
  const { setIsContextMenuOpen, updatePetPauseState } = require('./stateManager');
  const { createContextMenu } = require('./menuManager');
  const { messageToAi } = require('./aiChat');
  const { sendNotification } = require('../notify');

  // 顯示和位置相關
  ipcMain.handle('get-displays', () => {
    const displays = screen.getAllDisplays().map(d => ({
      id: d.id,
      bounds: d.bounds,
      workArea: d.workArea
    }));
    return { primary: screen.getPrimaryDisplay().id, displays };
  });

  ipcMain.handle('move-window', (_e, { x, y }) => {
    const petWindow = getPetWindow();
    if (petWindow) {
      petWindow.setPosition(Math.round(x), Math.round(y), false);
      // 立即更新 instachatWindow 位置
      updateInstachatPosition();
    }
  });

  ipcMain.handle('get-current-position', () => {
    const petWindow = getPetWindow();
    if (petWindow) {
      const [x, y] = petWindow.getPosition();
      return { x, y };
    }
    return { x: 0, y: 0 };
  });

  // 滑鼠事件相關
  ipcMain.handle('force-reset-mouse-state', () => {
    const petWindow = getPetWindow();
    if (petWindow) {
      console.log('強制重置滑鼠狀態');
      petWindow.setIgnoreMouseEvents(false); // 重置為可接收事件
    }
  });

  ipcMain.handle('toggle-mouse-through', (_e, ignore) => {
    const petWindow = getPetWindow();
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
    const petWindow = getPetWindow();
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.focus();
      petWindow.show();
      return true;
    }
    return false;
  });

  ipcMain.handle('reset-window-state', () => {
    const petWindow = getPetWindow();
    if (petWindow && process.platform === 'darwin') {
      petWindow.setAlwaysOnTop(false);
      petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
      setTimeout(() => {
        petWindow.setIgnoreMouseEvents(true, { forward: true });
      }, 100);
    }
  });

  // 窗口切換相關
  const { toggleChatWindow, toggleInstachatWindow } = require('./windowManager');
  
  ipcMain.handle('toggle-chat', () => toggleChatWindow());

  ipcMain.handle('show-instachat-at-pet', () => {
    const { getPetWindow, getInstachatWindow, getChatWindow } = require('./windowManager');
    const petWindow = getPetWindow();
    const instachatWindow = getInstachatWindow();
    const chatWindow = getChatWindow();
    
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

  // 右鍵選單相關
  ipcMain.handle('show-context-menu', (event) => {
    const petWindow = getPetWindow();
    setIsContextMenuOpen(true);
    updatePetPauseState(); // 選單開啟時暫停桌寵
    
    const menu = createContextMenu();
    
    try {
      menu.popup({ 
        window: petWindow,
        callback: () => {
          // 選單關閉時通知渲染進程並恢復桌寵狀態
          setIsContextMenuOpen(false);
          updatePetPauseState();
          if (petWindow) {
            petWindow.webContents.send('context-menu-closed');
          }
        }
      });
    } catch (error) {
      console.error('Context menu error:', error);
      // 如果選單顯示失敗，重置狀態
      setIsContextMenuOpen(false);
      updatePetPauseState();
    }
  });

  // 通知相關
  ipcMain.handle('notify', (_event, payload) => {
    try {
      return sendNotification(payload);
    } catch (err) {
      console.error('發送通知失敗:', err);
      return false;
    }
  });

  // AI 聊天相關
  ipcMain.handle('message-to-ai', async (_event, message) => {
    try {
      return await messageToAi(message);
    } catch (error) {
      console.error('AI 聊天錯誤:', error);
      return '抱歉，發生了錯誤。請稍後再試。';
    }
  });
}

module.exports = {
  setupIpcHandlers
};