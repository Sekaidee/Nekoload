<p align="center">
  <img src="https://raw.githubusercontent.com/Sekaidee/Nekoload/3b5fe3095680b55ac3b2d8064cb0ac88c7e3d889/src/renderer/SIcon.png" width="300" />
</p>

## Nekoload

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

