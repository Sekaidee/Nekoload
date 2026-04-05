const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nekoloadPrepare', {
  getTheme: () => ipcRenderer.invoke('app:getTheme'),
  getBackgroundOpacity: () => ipcRenderer.invoke('app:getBackgroundOpacity'),
  onThemeChanged: (cb) => {
    ipcRenderer.on('app:theme', (_, theme) => cb(theme));
  },
  onBackgroundOpacityChanged: (cb) => {
    ipcRenderer.on('app:background-opacity', (_, opacity) => cb(opacity));
  },
  onPrepareUpdate: (cb) => {
    ipcRenderer.on('prepare-window:update', (_, payload) => cb(payload));
  },
  getEmbedSubtitles: () => ipcRenderer.invoke('app:getEmbedSubtitles'),
  setEmbedSubtitles: (enabled) => ipcRenderer.invoke('app:setEmbedSubtitles', enabled),
  startDownload: (url, type, embedSubtitles) =>
    ipcRenderer.invoke('download:start', { url, type, embedSubtitles: Boolean(embedSubtitles) }),
  close: () => ipcRenderer.send('prepare-download-window:close'),
});
