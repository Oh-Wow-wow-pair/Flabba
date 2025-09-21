const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  moveWindow: (x, y) => ipcRenderer.invoke('move-window', { x, y }),
  getCurrentPosition: () => ipcRenderer.invoke('get-current-position'),
  setMouseThrough: (ignore) => ipcRenderer.invoke('toggle-mouse-through', ignore),
  forceResetMouseState: () => ipcRenderer.invoke('force-reset-mouse-state'), // 強制重置滑鼠狀態
  resetWindowState: () => ipcRenderer.invoke('reset-window-state'),
  refocusWindow: () => ipcRenderer.invoke('refocus-window'),
  toggleChat: () => ipcRenderer.invoke('toggle-chat'),
  messageToAi: async (message) => {
    return await ipcRenderer.invoke('message-to-ai', message);
  },
  showInstachatAtPet: () => ipcRenderer.invoke('show-instachat-at-pet'),
  sendLeaveData: (callback) => ipcRenderer.on('send-leave-data', (callback)),

  // 新增：顯示原生右鍵選單
  showContextMenu: () => ipcRenderer.invoke('show-context-menu'),

  // 監聽主進程訊息
  onResetDragState: (callback) => ipcRenderer.on('reset-drag-state', callback),
  onPetBounce: (callback) => ipcRenderer.on('pet-bounce', callback),
  onSetTemporaryPause: (callback) => ipcRenderer.on('set-temporary-pause', callback),
  onTogglePermanentPause: (callback) => ipcRenderer.on('toggle-permanent-pause', callback),
  onUpdatePauseState: (callback) => ipcRenderer.on('update-pause-state', callback), // 新增
  onForceResumeMovement: (callback) => ipcRenderer.on('force-resume-movement', callback), // 強制恢復移動
  onFocusChanged: (callback) => ipcRenderer.on('focus-changed', callback),
  onDesktopFocused: (callback) => ipcRenderer.on('desktop-focused', callback),
  onContextMenuClosed: (callback) => ipcRenderer.on('context-menu-closed', callback),
  notify: (payload) => ipcRenderer.invoke('notify', payload),
});
