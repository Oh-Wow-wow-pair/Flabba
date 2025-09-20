
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  moveWindow: (x, y) => ipcRenderer.invoke('move-window', { x, y }),
  getCurrentPosition: () => ipcRenderer.invoke('get-current-position'),
  setMouseThrough: (ignore) => ipcRenderer.invoke('toggle-mouse-through', ignore),
  resetWindowState: () => ipcRenderer.invoke('reset-window-state'),
  refocusWindow: () => ipcRenderer.invoke('refocus-window'),
  toggleChat: () => ipcRenderer.invoke('toggle-chat'),
  messageToAi: async (message) => {
    return await ipcRenderer.invoke('message-to-ai', message);
  },
  showInstachatAtPet: () => ipcRenderer.invoke('show-instachat-at-pet'),

  // 監聽主進程訊息
  onResetDragState: (callback) => ipcRenderer.on('reset-drag-state', callback)
});
