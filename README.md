# Nekoload

A clean, minimal YouTube downloader for Windows (Electron + yt-dlp + ffmpeg).

## Requirements

- **Node.js** (v18+)
- **yt-dlp** – [Download](https://github.com/yt-dlp/yt-dlp/releases) and place `yt-dlp.exe` in the app folder or ensure it’s in your PATH
- **ffmpeg** – Required by yt-dlp for merging video+audio. Install and add to PATH, or place in the same folder as the app

## Setup

```bash
cd Nekoload
npm install
```

## Run

```bash
npm start
```

## Build (optional)

```bash
npm run dist
```

Output is in the `dist` folder. The `Tools` folder (yt-dlp, ffmpeg) is included in the build as `resources/tools`. When packaged, the default download directory is the folder containing the executable. To have notifications show "Nekoload" instead of "Electron", see `NEKOLOAD_NOTIFICATION.txt`.

## Usage

1. Paste a YouTube URL in the input field.
2. Click **Audio** for best audio only, or **Video** for best video + audio (merged with ffmpeg).
3. Track progress in the list; double-click a completed item to open the file.
4. Use the ⋮ menu on each item for: Open file, Open folder, Rename, Delete.

## Project structure

```
Nekoload/
├── main.js           # Electron main process (window, IPC, yt-dlp spawn)
├── preload.js        # Context bridge (secure API for renderer)
├── package.json
├── Tools/            # yt-dlp, ffmpeg (included in build as resources/tools)
├── src/renderer/
│   ├── index.html
│   ├── styles.css
│   └── renderer.js
└── README.md
```
