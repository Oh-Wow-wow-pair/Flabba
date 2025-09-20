
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
  showInstachatAtPet: () => ipcRenderer.invoke('show-instachat-at-pet'),
  
  // 新增：顯示原生右鍵選單
  showContextMenu: () => ipcRenderer.invoke('show-context-menu'),

  // 監聽主進程訊息
  onResetDragState: (callback) => ipcRenderer.on('reset-drag-state', callback),
  onPetBounce: (callback) => ipcRenderer.on('pet-bounce', callback),
  onSetTemporaryPause: (callback) => ipcRenderer.on('set-temporary-pause', callback),
  onTogglePermanentPause: (callback) => ipcRenderer.on('toggle-permanent-pause', callback),
  onFocusChanged: (callback) => ipcRenderer.on('focus-changed', callback),
  onDesktopFocused: (callback) => ipcRenderer.on('desktop-focused', callback),
  onContextMenuClosed: (callback) => ipcRenderer.on('context-menu-closed', callback)
});
