# File & Folder Organizer

A powerful local Electron desktop utility application designed to help you quickly find files, track down identical duplicate files, and safely merge and organize chaotic directories.

## Core Features

### 1. Smart File Search
- Rapidly scan directories for files and folders by name.
- Real-time text filtering on scan results.
- Intuitive UI with 1-click actions: **Open File**, **Show in Explorer**, and **Move to Trash**.
- **Smart Exclusions**: Automatically ignores system caches, app dependencies, and dev folders (like `node_modules`, `.git`, `.vscode`, `vendor`, `build`, etc.) to keep your searches lightning fast. You can easily pick more folders to exclude through a multi-select visual browser.

### 2. Advanced Duplicate Detective
- Finds absolutely identical files even if their names have been changed.
- Uses a secure 2-pass verification algorithm:
  1. Groups files by their exact byte-size to minimize drive I/O.
  2. Runs a `SHA-256` content hash comparison over files of identical size to guarantee a 100% exact match before flagging.
- **Auto Batch Trashing**: Found a dozen identical copies scattered around? The app automatically parses modification times and provides a 1-click **Trash All Older Duplicates** button that systematically sends every older clone to the Recycle Bin while strictly preserving the single newest copy!

### 3. File Merge & Organize
- Safely consolidate multiple messy folders into one unified directory.
- Simply pick multiple "Source" folders and a single "Target" destination. The app recursively sweeps the sources.
- **Auto-Categorizing**: Moves incoming files directly into dedicated sub-folders named by their extension type (e.g., placing `.jpg` files into a `JPG/` folder, `.pdf` into `PDF/`).
- **Collision Proof**: If two differently-sourced files share the exact same name (e.g., `image.jpg`), the tool auto-renames the incoming file to `image_1.jpg` so nothing is ever overwritten or lost.
- **Dependency Guardrail**: This merge utility is strictly locked to personal media and document file types (images, videos, audio, readable text, PDFs, and archives). Software installers, application dependencies, system caches, and executables (`.exe`, `.dll`, `.ini`, etc.) are automatically ignored and left completely undisturbed so your installed applications don't accidentally get broken.

## Tech Stack
- **Framework**: Electron / Node.js
- **Backend Packages**: Native `fs` handles recursive directory parsing; native `crypto` handles hash generation.
- **Frontend**: Lightweight, vanilla HTML/JS/CSS interface featuring custom dark-mode aesthetics.

## How to Run

1. Open your terminal inside this project directory.
2. Install the necessary packages:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
