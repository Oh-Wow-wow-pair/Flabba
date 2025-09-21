const { Menu } = require('electron');

// 創建右鍵選單
function createContextMenu() {
  const { getIsPetPaused, setIsPetPaused, setIsContextMenuOpen, updatePetPauseState } = require('./stateManager');
  const { getPetWindow, getChatWindow, getInstachatWindow, getIsAnyWindowOpen, toggleChatWindow, toggleInstachatWindow } = require('./windowManager');
  
  const isPetPaused = getIsPetPaused();
  const isAnyWindowOpen = getIsAnyWindowOpen();
  const petWindow = getPetWindow();
  const chatWindow = getChatWindow();
  const instachatWindow = getInstachatWindow();
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '開啟 chatWindow',
      click: () => {
        // 立即關閉選單狀態
        setIsContextMenuOpen(false);
        
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
        // 立即關閉選單狀態
        setIsContextMenuOpen(false);
        
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
        // 立即關閉選單狀態，避免影響暫停邏輯
        setIsContextMenuOpen(false);
        
        // 選單項目被點擊時立即通知選單關閉
        if (petWindow) {
          petWindow.webContents.send('context-menu-closed');
        }
        
        // 如果有視窗開啟，關閉所有視窗並同時取消永久暫停
        if (isAnyWindowOpen) {
          if (chatWindow && chatWindow.isVisible()) {
            chatWindow.hide();
          }
          if (instachatWindow && instachatWindow.isVisible()) {
            instachatWindow.hide();
          }
          // 同時重置永久暫停狀態，確保桌寵能立即移動
          setIsPetPaused(false);
          // 強制發送恢復移動的信號
          if (petWindow) {
            petWindow.webContents.send('force-resume-movement');
          }
        } else {
          // 沒有視窗開啟，切換永久暫停狀態
          const newPauseState = !isPetPaused;
          setIsPetPaused(newPauseState);
          // 通知渲染進程切換暫停狀態
          if (petWindow) {
            if (newPauseState) {
              petWindow.webContents.send('toggle-permanent-pause', true);
            } else {
              petWindow.webContents.send('force-resume-movement');
            }
          }
        }
        
        // 延遲更新狀態，確保前端有時間處理
        setTimeout(() => {
          updatePetPauseState();
        }, 50);
      }
    }
  ]);
  return contextMenu;
}

module.exports = {
  createContextMenu
};