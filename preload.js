const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nekoload', {
  // Window
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // App
  getDownloadPath: () => ipcRenderer.invoke('app:getDownloadPath'),
  openSettings: () => ipcRenderer.send('open-settings'),

  // Download
  startDownload: (url, type) => ipcRenderer.invoke('download:start', { url, type }),
  cancelDownload: (id) => ipcRenderer.send('download:cancel', id),
  onDownloadStarted: (cb) => {
    ipcRenderer.on('download:started', (_, data) => cb(data));
  },
  onDownloadMetadata: (cb) => {
    ipcRenderer.on('download:metadata', (_, data) => cb(data));
  },
  onDownloadTitle: (cb) => {
    ipcRenderer.on('download:title', (_, data) => cb(data));
  },
  onDownloadProgress: (cb) => {
    ipcRenderer.on('download:progress', (_, data) => cb(data));
  },
  onDownloadDone: (cb) => {
    ipcRenderer.on('download:done', (_, data) => cb(data));
  },

  // File actions
  openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
  openFolder: (filePath) => ipcRenderer.invoke('file:openFolder', filePath),
  renameFile: (oldPath, newName) => ipcRenderer.invoke('file:rename', oldPath, newName),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
});
