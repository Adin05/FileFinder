const selectFolderBtn = document.getElementById('selectFolderBtn');
const folderPathInput = document.getElementById('folderPath');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const findDuplicatesBtn = document.getElementById('findDuplicatesBtn');
const stopBtn = document.getElementById('stopBtn');
const excludeInput = document.getElementById('excludeInput');
const filterInput = document.getElementById('filterInput');
const resultsList = document.getElementById('resultsList');
const statusArea = document.getElementById('statusArea');

let selectedPath = '';

selectFolderBtn.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
        selectedPath = folder;
        folderPathInput.value = folder;
        updateSearchButtonState();
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
    searchBtn.disabled = true;
    findDuplicatesBtn.disabled = true;
    stopBtn.disabled = false;
    selectFolderBtn.disabled = true;
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
    searchBtn.disabled = true;
    findDuplicatesBtn.disabled = true;
    stopBtn.disabled = false;
    selectFolderBtn.disabled = true;
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
    searchInput.disabled = false;
    excludeInput.disabled = false;
    
    if (result.completed) {
        statusArea.textContent = `Search completed. Found ${result.results} duplicate groups.`;
    } else {
        statusArea.textContent = `Search stopped by user. Found ${result.results} duplicate groups.`;
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
    
    const openBtn = document.createElement('button');
    openBtn.className = 'open-btn';
    openBtn.textContent = 'Show in Explorer';
    openBtn.addEventListener('click', () => {
        window.api.openPath(result.path);
    });
    
    li.appendChild(infoDiv);
    li.appendChild(openBtn);
    
    resultsList.appendChild(li);
});

window.api.onDuplicateResult((duplicates) => {
    const groupLi = document.createElement('li');
    groupLi.style.flexDirection = 'column';
    groupLi.style.alignItems = 'flex-start';
    groupLi.style.backgroundColor = '#2a2b3c';
    groupLi.style.borderLeft = '4px solid var(--accent)';
    groupLi.style.marginBottom = '10px';
    
    const header = document.createElement('div');
    header.style.marginBottom = '10px';
    header.style.fontWeight = 'bold';
    header.style.color = 'var(--accent)';
    header.textContent = `Duplicate Group (${duplicates.length} files with identical content)`;
    groupLi.appendChild(header);
    
    duplicates.forEach(result => {
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
        
        const openBtn = document.createElement('button');
        openBtn.className = 'open-btn';
        openBtn.textContent = 'Show in Explorer';
        openBtn.addEventListener('click', () => {
            window.api.openPath(result.path);
        });
        
        actionsDiv.appendChild(openBtn);
        
        fileDiv.appendChild(infoDiv);
        fileDiv.appendChild(actionsDiv);
        
        groupLi.appendChild(fileDiv);
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
