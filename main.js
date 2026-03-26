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

ipcMain.handle('select-multiple-folders', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });
  return result.filePaths;
});

ipcMain.handle('open-path', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-file', async (event, filePath) => {
  await shell.openPath(filePath);
});

ipcMain.handle('trash-file', async (event, filePath) => {
  await shell.trashItem(filePath);
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
                sizeMap.get(stats.size).push({name: entry.name, path: fullPath, mtimeMs: stats.mtimeMs});
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

let isMerging = false;

ipcMain.on('stop-merge', () => {
  isMerging = false;
});

const SAFE_EXTENSIONS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg', 'heic', 'raw',
  // Video
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v',
  // Audio
  'mp3', 'wav', 'ogg', 'flac', 'm4a', 'wma', 'aac',
  // Documents
  'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'csv', 'md',
  // Archives
  'zip', 'rar', '7z', 'tar', 'gz'
]);

ipcMain.handle('merge-folders', async (event, sourceFolders, targetFolder) => {
  let filesMoved = 0;
  isMerging = true;

  try {
    const allFiles = []; // { path, name, ext }

    // recursive file collector
    async function collectFiles(dir) {
      if (!isMerging) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
           if (!isMerging) return;
           const fullPath = path.join(dir, entry.name);
           if (entry.isDirectory()) {
             await collectFiles(fullPath);
           } else if (entry.isFile()) {
             let ext = path.extname(entry.name).replace('.', '').toLowerCase();
             // Only process recognized safe media/document extensions
             if (SAFE_EXTENSIONS.has(ext)) {
                 allFiles.push({ path: fullPath, name: entry.name, ext });
             }
           }
        }
      } catch (e) {}
    }

    event.sender.send('merge-progress', 'Scanning source folders for files...');
    for (const folder of sourceFolders) {
       await collectFiles(folder);
    }
    
    if (!isMerging) return { success: false, error: 'Stopped by user' };
    
    event.sender.send('merge-progress', `Found ${allFiles.length} files. Starting organization...`);
    
    // Process moves
    for (let i = 0; i < allFiles.length; i++) {
        if (!isMerging) break;
        const file = allFiles[i];
        
        // Target dir: targetFolder / ext
        const targetDir = path.join(targetFolder, file.ext.toUpperCase());
        try {
            await fs.mkdir(targetDir, { recursive: true });
        } catch(e) {}
        
        let destPath = path.join(targetDir, file.name);
        
        // Handle collision
        let counter = 1;
        while (fsSync.existsSync(destPath)) {
            const parsed = path.parse(file.name);
            destPath = path.join(targetDir, `${parsed.name}_${counter}${parsed.ext}`);
            counter++;
        }
        
        try {
            await fs.rename(file.path, destPath);
            filesMoved++;
        } catch (e) {
            if (e.code === 'EXDEV') {
                try {
                    await fs.copyFile(file.path, destPath);
                    await fs.unlink(file.path);
                    filesMoved++;
                } catch(err) {} // Ignore copy/unlink errs
            }
        }
        
        if (filesMoved % 25 === 0) {
            event.sender.send('merge-progress', `Moved ${filesMoved} of ${allFiles.length} files...`);
        }
        
        // Yield to event loop
        await new Promise(resolve => setImmediate(resolve));
    }
    
    return { success: true, filesMoved };
  } catch(e) {
    return { success: false, error: e.message };
  }
});
