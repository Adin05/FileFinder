const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('open-path', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

let isSearching = false;

ipcMain.on('stop-search', () => {
  isSearching = false;
});

ipcMain.handle('start-search', async (event, folderPath, searchTerm) => {
  isSearching = true;
  searchTerm = searchTerm.toLowerCase();
  
  const searchQueue = [folderPath];
  let resultCount = 0;

  try {
    while (searchQueue.length > 0 && isSearching) {
      const currentDir = searchQueue.shift();

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          if (!isSearching) break;

          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.name.toLowerCase().includes(searchTerm)) {
            event.sender.send('search-result', {
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory()
            });
            resultCount++;
          }

          if (entry.isDirectory()) {
            searchQueue.push(fullPath);
          }
        }
      } catch (err) {
        // Ignore permission denied or other errors
        console.error(`Error reading directory ${currentDir}`);
      }
      
      // Yield to event loop to prevent blocking main thread completely
      await new Promise(resolve => setImmediate(resolve));
    }
  } catch (error) {
    console.error("Search error:", error);
  }

  return { completed: isSearching, results: resultCount };
});
