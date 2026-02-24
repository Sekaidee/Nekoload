const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nekoloadSettings', {
  getDownloadPath: () => ipcRenderer.invoke('settings:getDownloadPath'),
  setDownloadPath: (dirPath) => ipcRenderer.invoke('settings:setDownloadPath', dirPath),
  selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),
  close: () => ipcRenderer.send('settings-window:close'),
});
