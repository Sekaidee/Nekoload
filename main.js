const { app, BrowserWindow, ipcMain, shell, Notification, dialog } = require('electron');
app.setAppUserModelId("SekaideStudio.Nekoload");
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');


let mainWindow = null;
let settingsWindow = null;
let currentTabUrl = null;

const CONFIG_PATH = path.join(app.getPath('userData'), 'nekoload-config.json');
const DEFAULT_THEME = 'cyan';
const VALID_THEMES = ['cyan', 'purple'];
const DEFAULT_OPACITY = 0.8;

function getDefaultDownloadPath() {
  if (app.isPackaged) return path.dirname(process.execPath);
  return app.getAppPath();
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const downloadPath = data.downloadPath && fs.existsSync(data.downloadPath)
        ? data.downloadPath
        : getDefaultDownloadPath();
      const theme = VALID_THEMES.includes(data.theme) ? data.theme : DEFAULT_THEME;
      const backgroundOpacity = typeof data.backgroundOpacity === 'number' && data.backgroundOpacity >= 0.2 && data.backgroundOpacity <= 1
        ? data.backgroundOpacity
        : DEFAULT_OPACITY;
      return { downloadPath, theme, backgroundOpacity };
    }
  } catch (_) {}
  return { downloadPath: getDefaultDownloadPath(), theme: DEFAULT_THEME, backgroundOpacity: DEFAULT_OPACITY };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (_) {}
}

function getDownloadPath() {
  return loadConfig().downloadPath;
}

function getTheme() {
  return loadConfig().theme;
}

function getBackgroundOpacity() {
  return loadConfig().backgroundOpacity;
}

function setBackgroundOpacity(opacity) {
  const value = typeof opacity === 'number' ? opacity : parseFloat(opacity);
  if (Number.isNaN(value) || value < 0.2 || value > 1) return false;
  const config = loadConfig();
  config.backgroundOpacity = value;
  saveConfig(config);
  return true;
}

function setTheme(theme) {
  if (!VALID_THEMES.includes(theme)) return false;
  const config = loadConfig();
  config.theme = theme;
  saveConfig(config);
  return true;
}

function getToolsPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'tools');
  }
  return path.join(__dirname, 'tools');
}

function getYtDlpPath() {
  const isWin = process.platform === 'win32';
  const name = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const localPath = path.join(getToolsPath(), name);
  return fs.existsSync(localPath) ? localPath : name;
}

function getFfmpegPath() {
  const isWin = process.platform === 'win32';
  const name = isWin ? 'ffmpeg.exe' : 'ffmpeg';
  const full = path.join(getToolsPath(), name);
  return fs.existsSync(full) ? full : null;
}

function getSpawnEnv() {
  const toolsDir = getToolsPath();
  const sep = process.platform === 'win32' ? ';' : ':';
  const pathKey = process.platform === 'win32' ? 'Path' : 'PATH';
  const existing = process.env[pathKey] || process.env.PATH || '';
  const newPath = toolsDir + sep + existing;
  return {
    ...process.env,
    [pathKey]: newPath,
    PATH: newPath,
    PYTHONIOENCODING: 'utf-8',
  };
}

function getAppIcon() {
  const png = path.join(__dirname, 'src', 'renderer', 'SIcon.png');
  return fs.existsSync(png) ? png : null;
}

/** Sanitize a string for use as filename: spaces to -, remove only invalid filename chars. Preserves Japanese, Arabic, and all Unicode letters. */
function sanitizeFilename(title) {
  if (!title || typeof title !== 'string') return 'download';
  const invalidFilenameChars = /[<>:"/\\|?*\x00-\x1f\x7f]/g;
  let s = title
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(invalidFilenameChars, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!s || s === '-' || s.length === 0) {
    return 'download';
  }
  return s;
}

/* ----------------------------------------------------------
   MAIN WINDOW
---------------------------------------------------------- */

function createMainWindow() {
  const iconPath = getAppIcon();
  mainWindow = new BrowserWindow({
    title: 'Nekoload',
    width: 720,
    height: 560,
    minWidth: 520,
    minHeight: 400,
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    show: false,
    ...(iconPath && { icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app:theme', getTheme());
    mainWindow.webContents.send('app:background-opacity', getBackgroundOpacity());
    if (currentTabUrl) {
      mainWindow.webContents.send('new-url', currentTabUrl);
    }
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => {
  if (!mainWindow) return;
  const win = mainWindow;
  win.webContents.executeJavaScript(
    `document.querySelector('.app')?.classList.add('window-closing')`
  ).catch(() => {});
  setTimeout(() => win.destroy(), 320);
});

ipcMain.handle('app:getDownloadPath', () => getDownloadPath());

/* ----------------------------------------------------------
   DOWNLOAD SYSTEM
---------------------------------------------------------- */

const activeDownloads = new Map();
const downloadThumbnails = new Map();

function downloadThumbToTemp(url, id) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(null);
      return;
    }
    let ext = '.jpg';
    try {
      ext = path.extname(new URL(url).pathname) || '.jpg';
    } catch (_) {}
    const tempPath = path.join(app.getPath('temp'), `nekoload-thumb-${id}${ext}`);
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(tempPath);
    protocol
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(tempPath, () => {});
          resolve(null);
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(tempPath);
          setTimeout(() => {
            try { fs.unlinkSync(tempPath); } catch (_) {}
          }, 15000);
        });
      })
      .on('error', () => {
        file.close();
        try { fs.unlinkSync(tempPath); } catch (_) {}
        resolve(null);
      });
  });
}

async function showDownloadNotification(success, body, thumbnailUrl, downloadId, filePath) {
  if (!Notification.isSupported()) return;
  let iconPath = null;
  if (thumbnailUrl && downloadId) {
    iconPath = await downloadThumbToTemp(thumbnailUrl, downloadId);
    downloadThumbnails.delete(downloadId);
  }
  const opts = {
    title: success ? 'Download complete' : 'Download failed',
    body: body || (success ? 'Done' : 'Unknown error'),
  };
  if (iconPath && fs.existsSync(iconPath)) opts.icon = iconPath;
  const n = new Notification(opts);
  n.on('click', () => {
    if (success && filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      mainWindow?.focus();
    }
  });
  n.show();
}

function extractYouTubeVideoId(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
      return u.pathname.slice(1);
    }
    if (hostname.includes('youtube.com') || hostname === 'youtube-nocookie.com') {
      if (u.searchParams.has('v')) {
        return u.searchParams.get('v');
      }
      const pathParts = u.pathname.split('/').filter(Boolean);
      if (pathParts[0] === 'shorts' && pathParts[1]) {
        return pathParts[1];
      }
    }
  } catch (_) {}
  return '';
}

function isYouTubeUrl(url) {
  return Boolean(extractYouTubeVideoId(url));
}

function fetchMetadata(ytDlpPath, url) {
  return new Promise((resolve) => {
    const child = spawn(
      ytDlpPath,
      ['--dump-json', '--no-playlist', url],
      { env: getSpawnEnv() }
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('close', () => {
      try {
        const data = JSON.parse(out);
        resolve({ title: data.title || '', thumbnail: data.thumbnail || '' });
      } catch (_) {
        resolve({ title: '', thumbnail: '' });
      }
    });
    child.on('error', () => resolve({ title: '', thumbnail: '' }));
  });
}

ipcMain.handle('download:start', async (_, { url, type }) => {
  const downloadPath = getDownloadPath();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ytDlpPath = getYtDlpPath();
  const videoId = extractYouTubeVideoId(url);
  const subDirName = type === 'audio' ? 'Audios' : 'Videos';
  const outDir = path.join(downloadPath, subDirName);
  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {
    console.warn('[Nekoload main] mkdir outDir', e.message);
  }

  mainWindow?.webContents.send('download:started', {
    id,
    title: 'Loading…',
    thumbnail: '',
    videoId,
    type,
  });

  const meta = await fetchMetadata(ytDlpPath, url);
  if (meta.thumbnail) downloadThumbnails.set(id, meta.thumbnail);

  const safeTitle = sanitizeFilename(meta.title || videoId || 'download');
  console.log('[Nekoload main] download:start', { originalTitle: meta.title, safeTitle, videoId, outDir });
  mainWindow?.webContents.send('download:metadata', {
    id,
    title: safeTitle,
    thumbnail: meta.thumbnail || '',
    videoId,
  });

  const outputTemplate = path.join(outDir, safeTitle + '.%(ext)s').replace(/\\/g, '/');
  const args = [
    '--newline',
    '--no-playlist',
    '--progress',
    '--no-part',
    '--no-continue',
    '-o',
    outputTemplate,
    '--print', 'after_move:filepath',
  ];

  const ffmpegPath = getFfmpegPath();
  if (ffmpegPath) args.push('--ffmpeg-location', ffmpegPath.replace(/\\/g, '/'));

  if (type === 'audio') {
    args.push('-f', 'bestaudio*', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    // Video + audio merged; subtitles embedded when available (requires ffmpeg).
    args.push(
      '-f',
      'bestvideo*[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
      '--merge-output-format',
      'mp4',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      'en.*,en',
      '--embed-subs'
    );
  }
  args.push(url);

  const child = spawn(ytDlpPath, args, {
    cwd: outDir,
    env: getSpawnEnv(),
    shell: false,
  });

  let lastProgress = 0;
  let lastFilename = '';
  let stderrData = '';
  activeDownloads.set(id, { process: child });

  function parseProgress(line) {
    const trimmed = line.trim();
    const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (match) {
      lastProgress = parseFloat(match[1]);
      mainWindow?.webContents.send('download:progress', { id, progress: lastProgress });
    }
    // Capture --print after_move:filepath (full path, relative path, or plain filename)
    if (trimmed && !trimmed.includes('[') && /\.(mp3|mp4|m4a|webm|mkv)(\s|$|"|')/i.test(trimmed)) {
      const filepath = trimmed.replace(/^["']|["']\s*$/g, '').trim();
      if (filepath) {
        lastFilename = path.basename(filepath);
        mainWindow?.webContents.send('download:title', { id, title: lastFilename.replace(/\.[^.]+$/, '') });
      }
    }
    // Capture destination: [download] Destination: path or [Merger] Merging formats into "path"
    if (line.includes('Destination:')) {
      const dest = line.split('Destination:')[1]?.trim().replace(/^["']|["']$/g, '');
      if (dest) {
        lastFilename = path.basename(dest);
        mainWindow?.webContents.send('download:title', {
          id,
          title: lastFilename.replace(/\.[^.]+$/, ''),
        });
      }
    }
    if (line.includes('Merging formats into')) {
      const part = line.split('Merging formats into')[1]?.trim();
      if (part) {
        const filepath = part.replace(/^["']|["']\s*$/g, '');
        if (filepath) {
          lastFilename = path.basename(filepath);
          mainWindow?.webContents.send('download:title', {
            id,
            title: lastFilename.replace(/\.[^.]+$/, ''),
          });
        }
      }
    }
  }

  child.stdout.on('data', (d) => d.toString().split('\n').forEach(parseProgress));
  child.stderr.on('data', (d) => {
    const text = d.toString();
    stderrData += text;
    text.split('\n').forEach(parseProgress);
  });

  function findNewestFileInDir(dir, ext) {
    try {
      const files = fs.readdirSync(dir);
      const candidates = files
        .filter((f) => path.extname(f).toLowerCase() === ext)
        .map((f) => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtime.getTime() }));
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.mtime - a.mtime);
      return candidates[0].path;
    } catch (_) {
      return null;
    }
  }

  return new Promise((resolve) => {
    child.on('close', (code) => {
      activeDownloads.delete(id);
      const success = code === 0;
      let errorMessage = null;
      if (!success) {
        const match = stderrData.match(/ERROR:\s(.+)/i);
        errorMessage = match ? match[1].slice(0, 120) : `Exit code ${code}`;
      }
      let filePath = null;
      const ext = type === 'audio' ? '.mp3' : '.mp4';
      const expectedFilename = safeTitle + ext;
      const expectedPath = path.join(outDir, expectedFilename);
      
      if (success) {
        if (fs.existsSync(expectedPath)) {
          filePath = expectedPath;
          lastFilename = expectedFilename;
          console.log('[Nekoload main] download:done – using expected filename', { expectedFilename });
        } else if (lastFilename && lastFilename.length > 0 && lastFilename !== '-' && lastFilename !== '-.mp4' && lastFilename !== '-.mp3') {
          const parsedPath = path.join(outDir, lastFilename);
          if (fs.existsSync(parsedPath)) {
            filePath = parsedPath;
            console.log('[Nekoload main] download:done – using parsed filename', { lastFilename });
          }
        }
        if (!filePath) {
          const found = findNewestFileInDir(downloadPath, ext);
          if (found) {
            filePath = found;
            lastFilename = path.basename(found);
            console.log('[Nekoload main] download:done fallback – using newest file', { ext, filePath });
          }
        }
        if (filePath && lastFilename !== expectedFilename) {
          if (!fs.existsSync(expectedPath)) {
            try {
              fs.renameSync(filePath, expectedPath);
              filePath = expectedPath;
              lastFilename = expectedFilename;
              console.log('[Nekoload main] download:done – renamed to expected filename', { from: path.basename(filePath), to: expectedFilename });
            } catch (e) {
              console.warn('[Nekoload main] download:done – rename failed', e.message);
            }
          } else {
            lastFilename = expectedFilename;
            filePath = expectedPath;
          }
        } else if (!filePath && safeTitle && safeTitle !== 'download') {
          lastFilename = expectedFilename;
        }
      }
      console.log('[Nekoload main] download:done', { id, success, lastFilename, downloadPath, filePath, fileExists: filePath ? fs.existsSync(filePath) : false });
      const displayTitle = lastFilename && lastFilename.length > 0 && lastFilename !== '-' && lastFilename !== '-.mp4' && lastFilename !== '-.mp3'
        ? lastFilename.replace(/\.[^.]+$/, '')
        : safeTitle;
      mainWindow?.webContents.send('download:done', {
        id,
        success,
        progress: success ? 100 : lastProgress,
        title: displayTitle,
        path: filePath,
        error: errorMessage,
      });
      showDownloadNotification(
        success,
        success ? lastFilename.replace(/\.[^.]+$/, '') : (errorMessage || 'Unknown error'),
        downloadThumbnails.get(id),
        id,
        filePath
      );
      resolve({ id, success });
    });

    child.on('error', (err) => {
      activeDownloads.delete(id);
      mainWindow?.webContents.send('download:done', {
        id,
        success: false,
        progress: 0,
        title: '',
        path: null,
        error: err.message,
      });
      showDownloadNotification(false, err.message || 'Unknown error', downloadThumbnails.get(id), id, null);
      resolve({ id, success: false });
    });
  });
});

/* ----------------------------------------------------------
   FILE ACTIONS
---------------------------------------------------------- */

ipcMain.handle('file:open', async (_, filePath) => {
  console.log('[Nekoload main] file:open received', { filePath, type: typeof filePath });
  if (!filePath || typeof filePath !== 'string') {
    console.warn('[Nekoload main] file:open skipped – invalid path');
    return '';
  }
  const resolved = path.resolve(path.normalize(filePath.trim()));
  const exists = fs.existsSync(resolved);
  console.log('[Nekoload main] file:open resolved', { resolved, exists });
  if (!exists) {
    console.warn('[Nekoload main] file:open – file does not exist');
    return 'File not found';
  }
  const err = await shell.openPath(resolved);
  console.log('[Nekoload main] file:open shell.openPath result', err || 'ok');
  return err;
});

ipcMain.handle('file:openFolder', (_, filePath) => {
  console.log('[Nekoload main] file:openFolder received', { filePath });
  if (!filePath || typeof filePath !== 'string') return;
  const resolved = path.resolve(path.normalize(filePath.trim()));
  if (!fs.existsSync(resolved)) {
    console.warn('[Nekoload main] file:openFolder – path does not exist', resolved);
    return;
  }
  shell.showItemInFolder(resolved);
});

ipcMain.handle('file:rename', (_, oldPath, newName) => {
  if (!fs.existsSync(oldPath)) return { ok: false };
  const dir = path.dirname(oldPath);
  const ext = path.extname(oldPath);
  const newPath = path.join(dir, newName + ext);
  try {
    fs.renameSync(oldPath, newPath);
    return { ok: true, path: newPath, filename: newName + ext };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('file:delete', (_, filePath) => {
  if (!filePath || typeof filePath !== 'string') return { ok: false, error: 'Invalid path' };
  const normalized = path.normalize(filePath);
  if (!fs.existsSync(normalized)) return { ok: false, error: 'File not found' };
  try {
    fs.unlinkSync(normalized);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

/* ----------------------------------------------------------
   SETTINGS
---------------------------------------------------------- */

ipcMain.handle('app:getTheme', () => getTheme());
ipcMain.handle('app:setTheme', (_, theme) => {
  const ok = setTheme(theme);
  if (!ok) return { ok: false };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:theme', theme);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('app:theme', theme);
  }
  return { ok: true };
});
ipcMain.handle('app:getBackgroundOpacity', () => getBackgroundOpacity());
ipcMain.handle('app:setBackgroundOpacity', (_, opacity) => {
  const ok = setBackgroundOpacity(opacity);
  if (!ok) return { ok: false };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:background-opacity', getBackgroundOpacity());
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('app:background-opacity', getBackgroundOpacity());
  }
  return { ok: true };
});

ipcMain.handle('settings:getDownloadPath', () => getDownloadPath());
ipcMain.handle('settings:getTheme', () => getTheme());
ipcMain.handle('settings:getBackgroundOpacity', () => getBackgroundOpacity());
ipcMain.handle('settings:setBackgroundOpacity', (_, opacity) => {
  const ok = setBackgroundOpacity(opacity);
  if (ok && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:background-opacity', getBackgroundOpacity());
  }
  return { ok };
});

ipcMain.handle('settings:setDownloadPath', (_, dirPath) => {
  if (!dirPath || !path.isAbsolute(dirPath) || !fs.existsSync(dirPath)) return { ok: false };
  const config = loadConfig();
  config.downloadPath = dirPath;
  saveConfig(config);
  return { ok: true };
});
ipcMain.handle('settings:setTheme', (_, theme) => {
  const ok = setTheme(theme);
  if (ok && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:theme', theme);
  }
  return { ok };
});

ipcMain.handle('settings:selectFolder', async () => {
  const win = settingsWindow || mainWindow;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Select download folder',
  });
  if (result.canceled || !result.filePaths?.length) return null;
  return result.filePaths[0];
});

ipcMain.on('open-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  const iconPath = getAppIcon();
  settingsWindow = new BrowserWindow({
    width: 620,
    height: 480,
    minWidth: 500,
    minHeight: 400,
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    title: 'Nekoload Settings',
    show: false,
    ...(iconPath && { icon: iconPath }),
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'settings.html'));
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  settingsWindow.on('closed', () => { settingsWindow = null; });
});

ipcMain.on('settings-window:close', () => settingsWindow?.close());

/* ----------------------------------------------------------
   APP LIFECYCLE
---------------------------------------------------------- */

function startUrlReceiver() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const urlObject = new URL(req.url, 'http://localhost');
    if (req.method !== 'POST' || urlObject.pathname !== '/url') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const url = (data.url || '').trim();
        if (!url || !isYouTubeUrl(url)) throw new Error('Invalid YouTube URL');
        currentTabUrl = url;
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('new-url', url);
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad Request');
      }
    });
  });

  server.listen(3000, () => {
    console.log('[Nekoload main] URL receiver listening on http://localhost:3000');
  });

  server.on('error', (err) => {
    console.error('[Nekoload main] URL receiver error', err.message);
  });
}

app.whenReady().then(() => {
  app.setName('Nekoload');
  startUrlReceiver();
  createMainWindow();
});

app.on('window-all-closed', () => app.quit());
