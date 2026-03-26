const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectMultipleFolders: () => ipcRenderer.invoke('select-multiple-folders'),
  startSearch: (folderPath, searchTerm, excludeList) => ipcRenderer.invoke('start-search', folderPath, searchTerm, excludeList),
  findDuplicates: (folderPath, excludeList) => ipcRenderer.invoke('find-duplicates', folderPath, excludeList),
  stopSearch: () => ipcRenderer.send('stop-search'),
  onSearchResult: (callback) => ipcRenderer.on('search-result', (_event, value) => callback(value)),
  onDuplicateResult: (callback) => ipcRenderer.on('duplicate-result', (_event, value) => callback(value)),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  trashFile: (filePath) => ipcRenderer.invoke('trash-file', filePath)
});
