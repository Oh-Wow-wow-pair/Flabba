
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  moveWindow: (x, y) => ipcRenderer.invoke('move-window', { x, y }),
  setMouseThrough: (ignore) => ipcRenderer.invoke('toggle-mouse-through', ignore),
  toggleChat: () => ipcRenderer.invoke('toggle-chat')
});
