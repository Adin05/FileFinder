const selectFolderBtn = document.getElementById('selectFolderBtn');
const folderPathInput = document.getElementById('folderPath');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const stopBtn = document.getElementById('stopBtn');
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
}

searchBtn.addEventListener('click', async () => {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm || !selectedPath) return;

    // Reset UI
    resultsList.innerHTML = '';
    searchBtn.disabled = true;
    stopBtn.disabled = false;
    selectFolderBtn.disabled = true;
    searchInput.disabled = true;
    statusArea.textContent = `Searching for "${searchTerm}" in ${selectedPath}...`;
    
    // Start Search
    const result = await window.api.startSearch(selectedPath, searchTerm);
    
    // Reset UI post-search
    searchBtn.disabled = false;
    stopBtn.disabled = true;
    selectFolderBtn.disabled = false;
    searchInput.disabled = false;
    
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
