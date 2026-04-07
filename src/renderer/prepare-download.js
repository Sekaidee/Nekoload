(function () {
  const api = window.nekoloadPrepare;
  if (!api) return;

  const thumb = document.getElementById('prepareThumb');
  const thumbPh = document.getElementById('prepareThumbPh');
  const titleEl = document.getElementById('prepareTitle');
  const metaEl = document.getElementById('prepareMeta');
  const btnDownload = document.getElementById('prepareDownloadBtn');
  const btnCancel = document.getElementById('prepareCancelBtn');
  const btnClose = document.getElementById('prepareCloseBtn');
  const embedRow = document.getElementById('prepareEmbedRow');
  const embedChk = document.getElementById('prepareEmbedSubtitlesChk');

  let state = { url: '', downloadType: '' };

  function applyTheme(theme) {
    document.documentElement.classList.toggle('theme-purple', theme === 'purple');
    document.documentElement.classList.toggle('theme-cyan', theme === 'cyan');
  }

  function applyOpacity(opacity) {
    if (typeof opacity !== 'number') opacity = parseFloat(opacity);
    if (Number.isNaN(opacity)) return;
    document.documentElement.style.setProperty('--app-opacity', opacity.toFixed(2));
  }

  function getYouTubeVideoId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') return u.pathname.replace(/^\//, '').split('/')[0];
      if (u.searchParams.has('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' && parts[1]) return parts[1];
    } catch (_) {}
    return '';
  }

  function thumbnailUrl(thumbnail, videoId) {
    if (thumbnail) return thumbnail;
    if (videoId) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return '';
  }

  function setThumb(thumbnail, videoId) {
    const u = thumbnailUrl(thumbnail, videoId);
    if (u) {
      thumb.hidden = false;
      thumb.src = u;
      thumb.alt = titleEl.textContent.trim() || 'Video thumbnail';
      thumbPh.classList.add('is-hidden');
      thumb.onerror = () => {
        thumb.hidden = true;
        thumbPh.classList.remove('is-hidden');
      };
    } else {
      thumb.hidden = true;
      thumb.removeAttribute('src');
      thumbPh.classList.remove('is-hidden');
    }
  }

  function syncEmbedSwitchClass() {
    if (!embedRow || !embedChk) return;
    embedRow.classList.toggle('is-checked', embedChk.checked);
  }

  function syncEmbedRowVisibility() {
    const isVideo = state.downloadType === 'video';
    embedRow.classList.toggle('is-visible', isVideo);
  }

  function applyPayload(payload) {
    if (!payload || !payload.url) return;
    state = { url: payload.url, downloadType: payload.downloadType };
    const vid = payload.videoId || getYouTubeVideoId(payload.url);
    syncEmbedRowVisibility();
    if (state.downloadType === 'video') syncEmbedSwitchClass();

    if (payload.status === 'loading') {
      titleEl.textContent = 'Fetching video info…';
      metaEl.textContent = 'Duration: — · Est. size: —';
      setThumb('', vid);
      btnDownload.disabled = false;
      btnDownload.textContent = payload.downloadType === 'audio' ? 'Download audio' : 'Download video';
      btnDownload.classList.toggle('is-audio', payload.downloadType === 'audio');
      btnDownload.classList.toggle('is-video', payload.downloadType === 'video');
      return;
    }

    if (payload.status === 'ready') {
      titleEl.textContent = payload.title || 'YouTube video';
      metaEl.textContent = `Duration: ${payload.durationLabel || '—'} · Est. size: ${payload.sizeLabel || '—'}`;
      setThumb(payload.thumbnail, vid);
      btnDownload.disabled = false;
      btnDownload.textContent = payload.downloadType === 'audio' ? 'Download audio' : 'Download video';
      btnDownload.classList.toggle('is-audio', payload.downloadType === 'audio');
      btnDownload.classList.toggle('is-video', payload.downloadType === 'video');
    }
  }

  function closeWithAnimation() {
    const appEl = document.querySelector('.prepare-download-app');
    if (appEl && !appEl.classList.contains('window-closing')) {
      appEl.classList.add('window-closing');
      setTimeout(() => api.close(), 280);
    } else {
      api.close();
    }
  }

  if (typeof api.getTheme === 'function') {
    api.getTheme().then(applyTheme).catch(() => {});
  }
  if (typeof api.getBackgroundOpacity === 'function') {
    api.getBackgroundOpacity().then(applyOpacity).catch(() => {});
  }
  if (typeof api.getEmbedSubtitles === 'function') {
    api.getEmbedSubtitles().then((on) => {
      if (embedChk) embedChk.checked = Boolean(on);
      syncEmbedSwitchClass();
    }).catch(() => {});
  } else {
    syncEmbedSwitchClass();
  }

  if (embedChk && typeof api.setEmbedSubtitles === 'function') {
    embedChk.addEventListener('change', () => {
      syncEmbedSwitchClass();
      api.setEmbedSubtitles(embedChk.checked).catch(() => {});
    });
  }

  if (typeof api.onThemeChanged === 'function') {
    api.onThemeChanged(applyTheme);
  }
  if (typeof api.onBackgroundOpacityChanged === 'function') {
    api.onBackgroundOpacityChanged(applyOpacity);
  }
  if (typeof api.onPrepareUpdate === 'function') {
    api.onPrepareUpdate(applyPayload);
  }
  if (typeof api.getPendingPrepare === 'function') {
    api.getPendingPrepare().then((payload) => {
      if (payload && payload.url) applyPayload(payload);
    }).catch(() => {});
  }

  btnCancel.addEventListener('click', () => closeWithAnimation());
  btnClose.addEventListener('click', () => closeWithAnimation());

  btnDownload.addEventListener('click', () => {
    const { url, downloadType: type } = state;
    if (!url || (type !== 'audio' && type !== 'video')) return;
    btnDownload.disabled = true;
    const subs = type === 'video' && embedChk && embedChk.checked;
    if (typeof api.startDownload !== 'function') {
      btnDownload.disabled = false;
      return;
    }
    api.startDownload(url, type, subs).catch((e) => {
      console.error(e);
      btnDownload.disabled = false;
    });
  });
})();
