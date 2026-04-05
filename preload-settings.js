const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nekoloadSettings', {
  getDownloadPath: () => ipcRenderer.invoke('settings:getDownloadPath'),
  getTheme: () => ipcRenderer.invoke('settings:getTheme'),
  getBackgroundOpacity: () => ipcRenderer.invoke('settings:getBackgroundOpacity'),
  setTheme: (theme) => ipcRenderer.invoke('settings:setTheme', theme),
  setBackgroundOpacity: (opacity) => ipcRenderer.invoke('settings:setBackgroundOpacity', opacity),
  onThemeChanged: (cb) => {
    ipcRenderer.on('app:theme', (_, theme) => cb(theme));
  },
  onBackgroundOpacityChanged: (cb) => {
    ipcRenderer.on('app:background-opacity', (_, opacity) => cb(opacity));
  },
  setDownloadPath: (dirPath) => ipcRenderer.invoke('settings:setDownloadPath', dirPath),
  getOpenAtLogin: () => ipcRenderer.invoke('settings:getOpenAtLogin'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('settings:setOpenAtLogin', enabled),
  selectFolder: () => ipcRenderer.invoke('settings:selectFolder'),
  close: () => ipcRenderer.send('settings-window:close'),
});
