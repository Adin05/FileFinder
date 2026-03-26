const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  startSearch: (folderPath, searchTerm) => ipcRenderer.invoke('start-search', folderPath, searchTerm),
  stopSearch: () => ipcRenderer.send('stop-search'),
  onSearchResult: (callback) => ipcRenderer.on('search-result', (_event, value) => callback(value)),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath)
});
