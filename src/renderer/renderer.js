(function () {
  const urlInput = document.getElementById('urlInput');
  const btnAudio = document.getElementById('btnAudio');
  const btnVideo = document.getElementById('btnVideo');
  const downloadList = document.getElementById('downloadList');
  const template = document.getElementById('downloadItemTemplate');
  if (!window.nekoload) return;

  const embedSubtitlesChk = document.getElementById('embedSubtitlesChk');

  const {
    startDownload,
    getEmbedSubtitles,
    setEmbedSubtitles,
    openFile,
    openFolder,
    renameFile,
    deleteFile,
    onDownloadStarted,
    onDownloadMetadata,
    onDownloadTitle,
    onDownloadProgress,
    onDownloadDone,
    getTheme,
    getBackgroundOpacity,
    onThemeChanged,
    onBackgroundOpacityChanged,
    onUrlReceived,
  } = window.nekoload;

  function applyTheme(theme) {
    document.documentElement.classList.toggle('theme-purple', theme === 'purple');
    document.documentElement.classList.toggle('theme-cyan', theme === 'cyan');
  }

  function applyOpacity(opacity) {
    if (typeof opacity !== 'number') opacity = parseFloat(opacity);
    if (Number.isNaN(opacity)) return;
    document.documentElement.style.setProperty('--app-opacity', opacity.toFixed(2));
  }

  getTheme().then(applyTheme).catch(() => {});
  getBackgroundOpacity().then(applyOpacity).catch(() => {});
  onThemeChanged(applyTheme);
  onBackgroundOpacityChanged(applyOpacity);

  const embedSubsLabel = embedSubtitlesChk?.closest('.panel-switch');
  function syncEmbedSubsToggleClass() {
    if (!embedSubsLabel || !embedSubtitlesChk) return;
    embedSubsLabel.classList.toggle('is-checked', embedSubtitlesChk.checked);
  }
  if (embedSubtitlesChk && getEmbedSubtitles) {
    getEmbedSubtitles().then((on) => {
      embedSubtitlesChk.checked = Boolean(on);
      syncEmbedSubsToggleClass();
    }).catch(() => {});
    embedSubtitlesChk.addEventListener('change', () => {
      syncEmbedSubsToggleClass();
      setEmbedSubtitles(embedSubtitlesChk.checked).catch(() => {});
    });
  }

  if (onUrlReceived) {
    onUrlReceived((url) => {
      if (urlInput) urlInput.value = url;
    });
  }

  // ---- Window controls ----
  document.querySelectorAll('.titlebar-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if (action === 'minimize') window.nekoload.minimize();
      else if (action === 'maximize') window.nekoload.maximize();
      else if (action === 'close') {
        const appEl = document.querySelector('.app');
        if (appEl && !appEl.classList.contains('window-closing')) {
          appEl.classList.add('window-closing');
          setTimeout(() => window.nekoload.close(), 320);
        } else {
          window.nekoload.close();
        }
      }
    });
  });

  document.getElementById('btnSettings')?.addEventListener('click', () => window.nekoload.openSettings());

  function isYouTubeUrl(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim();
    if (!/^https?:\/\//i.test(t)) return false;
    try {
      const u = new URL(t);
      if (u.hostname === 'youtu.be') return u.pathname.length > 1;
      if (u.hostname.includes('youtube.com')) return u.searchParams.has('v');
      return false;
    } catch (_) {
      return false;
    }
  }

  // ---- Start download ----
  function getUrl() {
    const url = (urlInput.value || '').trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) return null;
    return url;
  }

  function setButtonsReady() {
    [btnAudio, btnVideo].forEach((btn) => {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    });
  }

  function handleDownload(type) {
    const url = getUrl();
    if (!url) {
      urlInput.focus();
      urlInput.placeholder = 'Enter a valid URL…';
      return;
    }
    const clickedBtn = type === 'audio' ? btnAudio : btnVideo;
    clickedBtn.classList.add('is-loading');
    clickedBtn.disabled = true;
    const subs = type === 'video' && embedSubtitlesChk && embedSubtitlesChk.checked;
    startDownload(url, type, subs).catch((e) => {
      console.error(e);
      setButtonsReady();
    });
  }

  btnAudio.addEventListener('click', () => handleDownload('audio'));
  btnVideo.addEventListener('click', () => handleDownload('video'));

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleDownload('video');
  });

  // ---- Download list: click row to open file (delegated) ----
  downloadList.addEventListener('click', (e) => {
    if (e.target.closest('.download-menu-btn') || e.target.closest('.download-remove-btn')) return;
    const row = e.target.closest('.download-item');
    console.log('[Nekoload] Row click', { hasRow: !!row, hasState: !!(row && row._state), state: row && row._state });
    if (!row || !row._state) return;
    if (row._state.status === 'completed' && row._state.filePath) {
      console.log('[Nekoload] Opening file (row click)', row._state.filePath);
      openFile(row._state.filePath).then((err) => {
        if (err) console.error('[Nekoload] openFile error', err);
      }).catch((err) => console.error('[Nekoload] openFile failed', err));
    } else {
      console.log('[Nekoload] Row click ignored – not completed or no filePath', { status: row._state.status, filePath: row._state.filePath });
    }
  });

  // ---- Download list: get or create item ----
  function getItemElement(id) {
    return downloadList.querySelector(`.download-item[data-id="${id}"]`);
  }

  function updateEmptyState() {
    const emptyEl = document.getElementById('downloadListEmpty');
    if (!emptyEl) return;
    const hasItems = downloadList.querySelectorAll('.download-item').length > 0;
    emptyEl.classList.toggle('is-hidden', hasItems);
    emptyEl.setAttribute('aria-hidden', hasItems ? 'true' : 'false');
  }

  let openMenuForItemId = null;

  function openGlobalMenu(menuBtn, item) {
    const menu = document.getElementById('download-context-menu');
    const itemId = item.dataset.id;
    const isAlreadyOpen = !menu.hidden && openMenuForItemId === itemId;

    console.log('[Nekoload] Menu open', { itemId, isAlreadyOpen, menu: !!menu, itemState: item._state });

    if (isAlreadyOpen) {
      closeGlobalMenu();
      openMenuForItemId = null;
      return;
    }

    const rect = menuBtn.getBoundingClientRect();
    menu.innerHTML = '';
    menu.style.left = `${rect.right - 200}px`;
    menu.style.top = `${rect.bottom + 6}px`;

    const fp = (item._state && item._state.filePath) ? item._state.filePath : null;
    console.log('[Nekoload] Menu filePath (fp)', fp);
    const rowEl = item;

    const actions = [
      { label: 'Open file', action: 'open' },
      { label: 'Open folder', action: 'folder' },
      { label: 'Delete file and remove', action: 'deleteFile' },
    ];
    actions.forEach(({ label, action }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-action', action);
      btn.textContent = label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[Nekoload] Menu action', action, 'fp=', fp);
        closeGlobalMenu();
        openMenuForItemId = null;
        if (action === 'open' && fp) {
          console.log('[Nekoload] Opening file (menu)', fp);
          openFile(fp).then((err) => { if (err) console.error('[Nekoload] openFile error', err); }).catch((err) => console.error('[Nekoload] openFile failed', err));
        }
        if (action === 'folder' && fp) {
          console.log('[Nekoload] Opening folder (menu)', fp);
          openFolder(fp);
        }
        if (action === 'deleteFile') {
          if (fp) {
            if (window.confirm('Delete this file from disk and remove from list?')) {
              deleteFile(fp).then((res) => {
                if (res.ok) {
                  rowEl.remove();
                  updateEmptyState();
                }
              });
            }
          } else {
            rowEl.remove();
            updateEmptyState();
          }
        }
      });
      menu.appendChild(btn);
    });

    openMenuForItemId = itemId;
    menu.removeAttribute('hidden');
    menu.setAttribute('aria-hidden', 'false');
    menu.classList.add('is-open');

    const closeOnClick = (e) => {
      if (menu.contains(e.target) || menuBtn.contains(e.target)) return;
      closeGlobalMenu();
      openMenuForItemId = null;
      document.removeEventListener('click', closeOnClick);
    };
    setTimeout(() => document.addEventListener('click', closeOnClick), 0);
  }

  function closeGlobalMenu() {
    const menu = document.getElementById('download-context-menu');
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    setTimeout(() => { menu.hidden = true; }, 200);
    openMenuForItemId = null;
  }

  const typeIcons = {
    audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13M9 9l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
  };

  function thumbnailUrl(thumbnail, videoId) {
    if (thumbnail) return thumbnail;
    if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return '';
  }

  function createItem(id, title, thumbnail, videoId, type) {
    const t = type === 'audio' ? 'audio' : 'video';
    const li = template.content.cloneNode(true);
    const item = li.querySelector('.download-item');
    item.dataset.id = id;
    item.classList.add('item-enter');

    const typeIconEl = item.querySelector('.download-item-type-icon');
    if (typeIconEl) {
      typeIconEl.dataset.type = t;
      typeIconEl.innerHTML = typeIcons[t];
    }

    const img = item.querySelector('.download-thumb-img');
    const placeholder = item.querySelector('.download-thumb-placeholder');
    const thumbUrl = thumbnailUrl(thumbnail, videoId);
    if (thumbUrl) {
      img.src = thumbUrl;
      img.alt = title || '';
      img.onerror = () => { placeholder.classList.add('visible'); };
    } else {
      img.style.display = 'none';
      placeholder.classList.add('visible');
    }

    const titleEl = item.querySelector('.download-item-title');
    titleEl.textContent = title || '—';
    titleEl.title = title || '';

    const pctEl = item.querySelector('.download-pct');
    const statusEl = item.querySelector('.download-status-text');
    const progressBar = item.querySelector('.download-progress-bar');

    item._state = { id, title, thumbnail, videoId, progress: 0, status: 'downloading', filePath: null };

    function setProgress(pct) {
      item._state.progress = pct;
      pctEl.textContent = `${Math.round(pct)}%`;
      progressBar.style.width = `${pct}%`;
    }

    function setStatus(status, filePath, error) {
      item._state.status = status;
      item.dataset.status = status;
      if (error) item._state.error = error;
      if (status === 'completed') {
        item._state.filePath = filePath;
        statusEl.textContent = 'Completed';
        statusEl.className = 'download-status-text status-completed';
      } else if (status === 'failed') {
        const err = item._state.error || 'Failed';
        statusEl.textContent = err.length > 60 ? err.slice(0, 57) + '…' : err;
        statusEl.title = item._state.error || '';
        statusEl.className = 'download-status-text status-failed';
      } else {
        statusEl.textContent = 'Downloading…';
        statusEl.className = 'download-status-text';
      }
    }

    item._setProgress = setProgress;
    item._setStatus = setStatus;
    item._setTitle = (t) => {
      item._state.title = t;
      titleEl.textContent = t || '—';
      titleEl.title = t || '';
    };
    item._setThumbnail = (url) => {
      const u = thumbnailUrl(url, item._state.videoId);
      if (!u) return;
      img.style.display = '';
      img.src = u;
      img.alt = item._state.title || '';
      placeholder.classList.remove('visible');
      img.onerror = () => { placeholder.classList.add('visible'); };
    };

    const menuBtn = item.querySelector('.download-menu-btn');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openGlobalMenu(menuBtn, item);
    });

    const removeBtn = item.querySelector('.download-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        item.remove();
        updateEmptyState();
      });
    }

    downloadList.insertBefore(li, downloadList.firstChild);
    updateEmptyState();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        item.classList.remove('item-enter');
      });
    });
    return getItemElement(id);
  }

  // ---- IPC: download events ----
  onDownloadStarted(({ id, title, thumbnail, videoId, type }) => {
    createItem(id, title || 'Loading…', thumbnail, videoId, type);
    urlInput.value = '';
    urlInput.placeholder = 'Paste YouTube URL here…';
    setButtonsReady();
  });

  onDownloadMetadata(({ id, title, thumbnail, videoId }) => {
    const item = getItemElement(id);
    if (!item) return;
    if (title) item._setTitle(title);
    if (thumbnail || videoId) item._setThumbnail(thumbnail || '');
  });

  onDownloadTitle(({ id, title }) => {
    const item = getItemElement(id);
    if (item && title) item._setTitle(title);
  });

  onDownloadProgress(({ id, progress }) => {
    const item = getItemElement(id);
    if (item && item._setProgress) item._setProgress(progress);
  });

  onDownloadDone(({ id, success, progress, title, path: filePath, error }) => {
    console.log('[Nekoload] download:done', { id, success, path: filePath, title });
    const item = getItemElement(id);
    if (!item) {
      console.warn('[Nekoload] download:done – no item for id', id);
      return;
    }
    item._setProgress(progress);
    item._setStatus(success ? 'completed' : 'failed', filePath, error);
    if (title) item._setTitle(title);
    console.log('[Nekoload] Item after setStatus', { id, status: item._state.status, filePath: item._state.filePath });
    try {
      const sound = new Audio(success ? 'Success.wav' : 'Fail.wav');
      sound.volume = 0.8;
      sound.play().catch(() => {});
    } catch (_) {}
  });
})();
