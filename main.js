const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const crypto = require('crypto');
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

ipcMain.handle('start-search', async (event, folderPath, searchTerm, excludeList = []) => {
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
            if (!excludeList.includes(entry.name.toLowerCase())) {
              searchQueue.push(fullPath);
            }
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

async function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

ipcMain.handle('find-duplicates', async (event, folderPath, excludeList = []) => {
  isSearching = true;
  
  const searchQueue = [folderPath];
  let sizeMap = new Map(); // size -> array of file paths

  try {
    // Stage 1: Collect files by size
    while (searchQueue.length > 0 && isSearching) {
      const currentDir = searchQueue.shift();

      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          if (!isSearching) break;

          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludeList.includes(entry.name.toLowerCase())) {
              searchQueue.push(fullPath);
            }
          } else if (entry.isFile()) {
            try {
              const stats = await fs.stat(fullPath);
              if (stats.size > 0) { // ignore empty files
                if (!sizeMap.has(stats.size)) {
                  sizeMap.set(stats.size, []);
                }
                sizeMap.get(stats.size).push({name: entry.name, path: fullPath});
              }
            } catch(e) {
              // Ignore stat errors
            }
          }
        }
      } catch (err) {
        // Ignore permission denied or other errors
        console.error(`Error reading directory ${currentDir}`);
      }
      
      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
    }

    if (!isSearching) return { completed: false, results: 0 };

    // Stage 2: Hash files with same size to confirm duplicates
    let duplicateGroupsFound = 0;
    
    for (const [size, files] of sizeMap.entries()) {
      if (!isSearching) break;
      if (files.length > 1) {
        const hashMap = new Map();
        for (const file of files) {
          if (!isSearching) break;
          try {
            const hash = await getFileHash(file.path);
            if (!hashMap.has(hash)) {
              hashMap.set(hash, []);
            }
            hashMap.get(hash).push(file);
          } catch(e) {
            // Ignore hash read errors
          }
        }
        
        for (const [hash, duplicates] of hashMap.entries()) {
          if (duplicates.length > 1) {
            duplicateGroupsFound++;
            event.sender.send('duplicate-result', duplicates);
          }
        }
      }
    }
    
    return { completed: isSearching, results: duplicateGroupsFound };

  } catch (error) {
    console.error("Duplicate search error:", error);
    return { completed: false, results: 0 };
  }
});
