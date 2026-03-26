const selectFolderBtn = document.getElementById('selectFolderBtn');
const folderPathInput = document.getElementById('folderPath');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const findDuplicatesBtn = document.getElementById('findDuplicatesBtn');
const stopBtn = document.getElementById('stopBtn');
const selectExcludeBtn = document.getElementById('selectExcludeBtn');
const excludeInput = document.getElementById('excludeInput');
const filterInput = document.getElementById('filterInput');
const batchTrashAllBtn = document.getElementById('batchTrashAllBtn');
const resultsList = document.getElementById('resultsList');
const statusArea = document.getElementById('statusArea');

let currentDuplicateGroups = [];

let selectedPath = '';

const DEFAULT_EXCLUDES = 'node_modules, .git, vendor, packages, target, build, dist, out, __pycache__, venv, env, .idea, .vscode, wwwroot, wwroot, bin, bi, lib, release, public, etc, css, js';

selectFolderBtn.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
        selectedPath = folder;
        folderPathInput.value = folder;
        excludeInput.value = DEFAULT_EXCLUDES;
        updateSearchButtonState();
    }
});

selectExcludeBtn.addEventListener('click', async () => {
    const folders = await window.api.selectMultipleFolders();
    if (folders && folders.length > 0) {
        folders.forEach(folder => {
            // Extract the target folder name
            const normalizedPath = folder.replace(/\\/g, '/');
            const folderName = normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
            
            if (folderName) {
                const currentList = getExcludeList();
                if (!currentList.includes(folderName.toLowerCase())) {
                    const currentVal = excludeInput.value.trim();
                    excludeInput.value = currentVal ? `${currentVal}, ${folderName}` : folderName;
                }
            }
        });
    }
});

searchInput.addEventListener('input', updateSearchButtonState);

function updateSearchButtonState() {
    searchBtn.disabled = !selectedPath || searchInput.value.trim() === '';
    findDuplicatesBtn.disabled = !selectedPath;
}

function getExcludeList() {
    return excludeInput.value.split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0);
}

searchBtn.addEventListener('click', async () => {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm || !selectedPath) return;

    // Reset UI
    resultsList.innerHTML = '';
    filterInput.value = '';
    batchTrashAllBtn.style.display = 'none';
    searchBtn.disabled = true;
    findDuplicatesBtn.disabled = true;
    stopBtn.disabled = false;
    selectFolderBtn.disabled = true;
    selectExcludeBtn.disabled = true;
    searchInput.disabled = true;
    excludeInput.disabled = true;
    statusArea.textContent = `Searching for "${searchTerm}" in ${selectedPath}...`;
    
    // Start Search
    const excludeList = getExcludeList();
    const result = await window.api.startSearch(selectedPath, searchTerm, excludeList);
    
    // Reset UI post-search
    updateSearchButtonState();
    stopBtn.disabled = true;
    selectFolderBtn.disabled = false;
    selectExcludeBtn.disabled = false;
    searchInput.disabled = false;
    excludeInput.disabled = false;
    
    if (result.completed) {
        statusArea.textContent = `Search completed. Found ${result.results} matches.`;
    } else {
        statusArea.textContent = `Search stopped by user. Found ${result.results} matches.`;
    }
});

stopBtn.addEventListener('click', () => {
    window.api.stopSearch();
    statusArea.textContent = 'Stopping search...';
    stopBtn.disabled = true;
});

findDuplicatesBtn.addEventListener('click', async () => {
    if (!selectedPath) return;

    // Reset UI
    resultsList.innerHTML = '';
    filterInput.value = '';
    batchTrashAllBtn.style.display = 'none';
    currentDuplicateGroups = [];
    searchBtn.disabled = true;
    findDuplicatesBtn.disabled = true;
    stopBtn.disabled = false;
    selectFolderBtn.disabled = true;
    selectExcludeBtn.disabled = true;
    searchInput.disabled = true;
    excludeInput.disabled = true;
    statusArea.textContent = `Scanning for duplicate files in ${selectedPath}... (This may take a while)`;
    
    // Start Search
    const excludeList = getExcludeList();
    const result = await window.api.findDuplicates(selectedPath, excludeList);
    
    // Reset UI post-search
    updateSearchButtonState();
    stopBtn.disabled = true;
    selectFolderBtn.disabled = false;
    selectExcludeBtn.disabled = false;
    searchInput.disabled = false;
    excludeInput.disabled = false;
    
    if (result.completed) {
        statusArea.textContent = `Search completed. Found ${result.results} duplicate groups.`;
    } else {
        statusArea.textContent = `Search stopped by user. Found ${result.results} duplicate groups.`;
    }
    
    if (result.results > 0) {
        batchTrashAllBtn.style.display = 'block';
    }
});

window.api.onSearchResult((result) => {
    const li = document.createElement('li');
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'file-info';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = result.name + (result.isDirectory ? ' (Folder)' : '');
    
    const pathSpan = document.createElement('span');
    pathSpan.className = 'file-path';
    pathSpan.textContent = result.path;
    
    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(pathSpan);
    
    const actionsDiv = document.createElement('div');
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '5px';
    
    const openFileBtn = document.createElement('button');
    openFileBtn.className = 'open-btn';
    openFileBtn.textContent = 'Open';
    openFileBtn.addEventListener('click', () => {
        window.api.openFile(result.path);
    });

    const openBtn = document.createElement('button');
    openBtn.className = 'open-btn';
    openBtn.textContent = 'Show in Explorer';
    openBtn.addEventListener('click', () => {
        window.api.openPath(result.path);
    });

    const trashBtn = document.createElement('button');
    trashBtn.className = 'open-btn';
    trashBtn.style.backgroundColor = 'var(--accent)';
    trashBtn.textContent = 'Trash';
    trashBtn.addEventListener('click', async () => {
        try {
            await window.api.trashFile(result.path);
            li.remove();
        } catch (error) {
            console.error('Failed to trash file:', error);
        }
    });
    
    actionsDiv.appendChild(openFileBtn);
    actionsDiv.appendChild(openBtn);
    actionsDiv.appendChild(trashBtn);
    
    li.appendChild(infoDiv);
    li.appendChild(actionsDiv);
    
    resultsList.appendChild(li);
});

window.api.onDuplicateResult((duplicates) => {
    const groupLi = document.createElement('li');
    groupLi.style.flexDirection = 'column';
    groupLi.style.alignItems = 'flex-start';
    groupLi.style.backgroundColor = '#2a2b3c';
    groupLi.style.borderLeft = '4px solid var(--accent)';
    groupLi.style.marginBottom = '10px';
    
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.width = '100%';
    headerRow.style.marginBottom = '10px';
    
    const header = document.createElement('div');
    header.style.fontWeight = 'bold';
    header.style.color = 'var(--accent)';
    header.textContent = `Duplicate Group (${duplicates.length} files with identical content)`;
    
    // Sort duplicates newest first
    duplicates.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
    
    const fileElements = [];
    const groupData = { duplicates, fileElements, groupLi, headerRow };
    currentDuplicateGroups.push(groupData);

    const batchTrashBtn = document.createElement('button');
    batchTrashBtn.className = 'open-btn';
    batchTrashBtn.style.backgroundColor = 'var(--accent)';
    batchTrashBtn.style.color = '#11111b';
    batchTrashBtn.textContent = 'Trash Older Copies';
    
    const doBatchTrash = async (btn) => {
        btn.disabled = true;
        btn.textContent = 'Trashing...';
        
        for (let i = 1; i < duplicates.length; i++) {
            try {
                await window.api.trashFile(duplicates[i].path);
                if (fileElements[i]) fileElements[i].remove();
            } catch (err) {
                console.error(err);
            }
        }
        
        btn.remove();
        header.textContent = `Resolved Group (kept newest copy)`;
    };
    
    batchTrashBtn.addEventListener('click', () => doBatchTrash(batchTrashBtn));
    groupData.doBatchTrash = doBatchTrash;
    groupData.batchTrashBtn = batchTrashBtn;

    headerRow.appendChild(header);
    headerRow.appendChild(batchTrashBtn);
    groupLi.appendChild(headerRow);
    
    duplicates.forEach((result, index) => {
        const fileDiv = document.createElement('div');
        fileDiv.style.display = 'flex';
        fileDiv.style.justifyContent = 'space-between';
        fileDiv.style.width = '100%';
        fileDiv.style.padding = '5px 0';
        fileDiv.style.borderBottom = '1px dashed var(--border)';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'file-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = result.name;
        
        const pathSpan = document.createElement('span');
        pathSpan.className = 'file-path';
        pathSpan.textContent = result.path;
        
        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(pathSpan);
        
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '5px';
        
        const openFileBtn = document.createElement('button');
        openFileBtn.className = 'open-btn';
        openFileBtn.textContent = 'Open';
        openFileBtn.addEventListener('click', () => {
            window.api.openFile(result.path);
        });
        
        const openBtn = document.createElement('button');
        openBtn.className = 'open-btn';
        openBtn.textContent = 'Show in Explorer';
        openBtn.addEventListener('click', () => {
            window.api.openPath(result.path);
        });

        const trashBtn = document.createElement('button');
        trashBtn.className = 'open-btn';
        trashBtn.style.backgroundColor = 'var(--accent)';
        trashBtn.textContent = 'Trash';
        trashBtn.addEventListener('click', async () => {
            try {
                await window.api.trashFile(result.path);
                fileDiv.remove();
                if (groupLi.querySelectorAll('.file-info').length === 0) {
                    groupLi.remove();
                }
            } catch (error) {
                console.error('Failed to trash file:', error);
            }
        });
        
        actionsDiv.appendChild(openFileBtn);
        actionsDiv.appendChild(openBtn);
        actionsDiv.appendChild(trashBtn);
        
        fileDiv.appendChild(infoDiv);
        fileDiv.appendChild(actionsDiv);
        
        groupLi.appendChild(fileDiv);
        fileElements[index] = fileDiv;
    });
    
    // remove last border bottom
    if (groupLi.lastChild) {
        groupLi.lastChild.style.borderBottom = 'none';
    }
    
    resultsList.appendChild(groupLi);
});
filterInput.addEventListener('input', () => {
    const filterTerm = filterInput.value.toLowerCase();
    const listItems = resultsList.querySelectorAll(':scope > li');
    
    listItems.forEach(li => {
        const textContent = li.textContent.toLowerCase();
        if (textContent.includes(filterTerm)) {
            li.style.display = '';
        } else {
            li.style.display = 'none';
        }
    });
});

batchTrashAllBtn.addEventListener('click', async () => {
    batchTrashAllBtn.disabled = true;
    batchTrashAllBtn.textContent = 'Trashing All Older Files...';
    
    for (const group of currentDuplicateGroups) {
        if (group.groupLi.parentNode) { // Check if it's still in the list
            await group.doBatchTrash(group.batchTrashBtn);
        }
    }
    
    batchTrashAllBtn.textContent = 'Trash All Older Duplicates';
    batchTrashAllBtn.disabled = false;
    batchTrashAllBtn.style.display = 'none';
});

// --- Tab Logic ---
const tabSearch = document.getElementById('tabSearch');
const tabMerge = document.getElementById('tabMerge');
const searchView = document.getElementById('searchView');
const mergeView = document.getElementById('mergeView');

tabSearch.addEventListener('click', () => {
    tabSearch.classList.add('active');
    tabMerge.classList.remove('active');
    searchView.style.display = 'flex';
    mergeView.style.display = 'none';
});

tabMerge.addEventListener('click', () => {
    tabMerge.classList.add('active');
    tabSearch.classList.remove('active');
    mergeView.style.display = 'flex';
    searchView.style.display = 'none';
});

// --- Merge & Organize Logic ---
const selectMergeSourceBtn = document.getElementById('selectMergeSourceBtn');
const selectMergeTargetBtn = document.getElementById('selectMergeTargetBtn');
const mergeTargetPath = document.getElementById('mergeTargetPath');
const mergeSourcesList = document.getElementById('mergeSourcesList');
const startMergeBtn = document.getElementById('startMergeBtn');
const stopMergeBtn = document.getElementById('stopMergeBtn');
const mergeStatusArea = document.getElementById('mergeStatusArea');

let mergeSources = [];
let mergeTarget = '';

function updateMergeSourcesUI() {
    mergeSourcesList.innerHTML = '';
    
    if (mergeSources.length === 0) {
        mergeSourcesList.innerHTML = '<span style="color: #6c7086;">No source folders selected.</span>';
    } else {
        mergeSources.forEach((sourcePath) => {
            const chip = document.createElement('div');
            chip.className = 'folder-chip';
            
            const textSpan = document.createElement('span');
            textSpan.textContent = sourcePath;
            textSpan.style.wordBreak = 'break-all';
            textSpan.style.fontSize = '0.9em';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-chip';
            removeBtn.textContent = 'X';
            removeBtn.title = 'Remove folder';
            removeBtn.addEventListener('click', () => {
                mergeSources = mergeSources.filter(p => p !== sourcePath);
                updateMergeSourcesUI();
                updateStartMergeBtn();
            });
            
            chip.appendChild(textSpan);
            chip.appendChild(removeBtn);
            mergeSourcesList.appendChild(chip);
        });
    }
}

function updateStartMergeBtn() {
    startMergeBtn.disabled = mergeSources.length === 0 || !mergeTarget;
}

selectMergeSourceBtn.addEventListener('click', async () => {
    const folders = await window.api.selectMultipleFolders();
    if (folders && folders.length > 0) {
        folders.forEach(folder => {
            if (!mergeSources.includes(folder)) {
                mergeSources.push(folder);
            }
        });
        updateMergeSourcesUI();
        updateStartMergeBtn();
    }
});

selectMergeTargetBtn.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
        mergeTarget = folder;
        mergeTargetPath.value = mergeTarget;
        updateStartMergeBtn();
    }
});

startMergeBtn.addEventListener('click', async () => {
    if (mergeSources.length === 0 || !mergeTarget) return;
    
    startMergeBtn.disabled = true;
    stopMergeBtn.disabled = false;
    selectMergeSourceBtn.disabled = true;
    selectMergeTargetBtn.disabled = true;
    
    mergeStatusArea.textContent = 'Starting merge process...';
    
    const result = await window.api.startMerge(mergeSources, mergeTarget);
    
    startMergeBtn.disabled = false;
    stopMergeBtn.disabled = true;
    selectMergeSourceBtn.disabled = false;
    selectMergeTargetBtn.disabled = false;
    
    if (result.success) {
        mergeStatusArea.textContent = `Merge complete. Organized ${result.filesMoved} files.`;
    } else {
        mergeStatusArea.textContent = `Merge stopped or failed: ${result.error || ''}`;
    }
});

stopMergeBtn.addEventListener('click', () => {
    window.api.stopMerge();
    mergeStatusArea.textContent = 'Stopping merge process...';
    stopMergeBtn.disabled = true;
});

window.api.onMergeProgress((message) => {
    mergeStatusArea.textContent = message;
});

updateMergeSourcesUI();
