(function () {
  const FLOAT_ID = 'nekoload-yt-float';
  const STORAGE_KEY = 'nekoloadFloatPosition';
  const FLOAT_GIF_URL =
    'https://ribvfsoauqiriofyrxiq.supabase.co/storage/v1/object/public/sekaide/nekoload-float.gif';

  function currentVideoUrl() {
    try {
      const u = new URL(location.href);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        const id = u.pathname.replace(/^\//, '').split('/')[0];
        return id ? `https://www.youtube.com/watch?v=${id}` : '';
      }
      if (!host.includes('youtube.com')) return '';
      const v = u.searchParams.get('v');
      if (u.pathname === '/watch' && v) {
        return `https://www.youtube.com/watch?v=${v}`;
      }
      const shorts = u.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shorts) return `https://www.youtube.com/shorts/${shorts[1]}`;
      const live = u.pathname.match(/^\/live\/([^/?]+)/);
      if (live) return `https://www.youtube.com/watch?v=${live[1]}`;
    } catch (_) {}
    return '';
  }

  function isVideoPage() {
    return Boolean(currentVideoUrl());
  }

  let root = null;
  let removeFullscreenListener = null;

  function fallbackIconUrl() {
    try {
      return chrome.runtime.getURL('icon128.png');
    } catch (_) {
      return chrome.runtime.getURL('icon.png');
    }
  }

  function readSavedPosition() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([STORAGE_KEY], (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const p = res?.[STORAGE_KEY];
          if (!p || typeof p.left !== 'number' || typeof p.top !== 'number') {
            resolve(null);
            return;
          }
          resolve(p);
        });
      } catch (_) {
        resolve(null);
      }
    });
  }

  function savePosition(left, top) {
    try {
      chrome.storage.local.set({
        [STORAGE_KEY]: { left: Math.round(left), top: Math.round(top) },
      });
    } catch (_) {}
  }

  function clampToViewport(left, top) {
    if (!root) return { left, top };
    const rect = root.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
    return {
      left: Math.min(Math.max(8, left), maxLeft),
      top: Math.min(Math.max(8, top), maxTop),
    };
  }

  function applyPosition(left, top) {
    if (!root) return;
    const p = clampToViewport(left, top);
    root.style.left = `${p.left}px`;
    root.style.top = `${p.top}px`;
    root.style.right = 'auto';
  }

  function isFullscreenNow() {
    return Boolean(document.fullscreenElement);
  }

  function setFullscreenHidden(hidden) {
    if (!root) return;
    root.classList.toggle('is-fullscreen-hidden', Boolean(hidden));
  }

  async function mount() {
    if (root || !isVideoPage()) return;
    root = document.createElement('div');
    root.id = FLOAT_ID;
    root.innerHTML = `
      <div class="nekoload-float-inner">
        <button type="button" class="nekoload-float-gif" title="Nekoload — tap to show downloads" aria-label="Nekoload" aria-expanded="false" aria-controls="nekoload-float-actions">
          <img src="" alt="" />
        </button>
        <div id="nekoload-float-actions" class="nekoload-float-actions" role="group" aria-label="Nekoload download options">
          <button type="button" class="nekoload-btn nekoload-btn-audio" data-type="audio">Download as Audio</button>
          <button type="button" class="nekoload-btn nekoload-btn-video" data-type="video">Download as Video</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(root);
    const defaultLeft = window.innerWidth - 16 - 56;
    applyPosition(defaultLeft, 72);
    const saved = await readSavedPosition();
    if (saved && root) applyPosition(saved.left, saved.top);

    const inner = root.querySelector('.nekoload-float-inner');
    const gifBtn = root.querySelector('.nekoload-float-gif');
    const img = root.querySelector('.nekoload-float-gif img');
    if (img) {
      img.setAttribute('draggable', 'false');
      img.addEventListener('dragstart', (e) => e.preventDefault());
      img.addEventListener('mousedown', (e) => e.preventDefault());
    }
    if (img) {
      img.src = FLOAT_GIF_URL;
      img.onerror = () => {
        img.onerror = null;
        try {
          img.src = chrome.runtime.getURL('nekoload-float.gif');
        } catch (_) {
          img.src = fallbackIconUrl();
        }
        img.onerror = () => {
          img.onerror = null;
          img.src = fallbackIconUrl();
        };
      };
    }

    let dragStartX = 0;
    let dragStartY = 0;
    let startLeft = 0;
    let startTop = 0;
    let isDragging = false;
    let suppressNextClick = false;

    gifBtn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const rect = root.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      isDragging = false;
      gifBtn.setPointerCapture?.(e.pointerId);
    });

    gifBtn.addEventListener('pointermove', (e) => {
      if ((e.buttons & 1) !== 1) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (!isDragging && Math.hypot(dx, dy) > 6) {
        isDragging = true;
        root.classList.add('is-dragging');
        inner.classList.remove('is-expanded');
        gifBtn.setAttribute('aria-expanded', 'false');
      }
      if (!isDragging) return;
      applyPosition(startLeft + dx, startTop + dy);
    });

    function endDrag() {
      if (!root) return;
      if (isDragging) {
        isDragging = false;
        suppressNextClick = true;
        root.classList.remove('is-dragging');
        const rect = root.getBoundingClientRect();
        savePosition(rect.left, rect.top);
        setTimeout(() => {
          suppressNextClick = false;
        }, 120);
      }
    }

    gifBtn.addEventListener('pointerup', endDrag);
    gifBtn.addEventListener('pointercancel', endDrag);

    gifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (suppressNextClick) return;
      inner.classList.toggle('is-expanded');
      gifBtn.setAttribute('aria-expanded', inner.classList.contains('is-expanded') ? 'true' : 'false');
    });

    root.querySelector('.nekoload-float-actions').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-type]');
      if (!btn) return;
      e.stopPropagation();
      const downloadType = btn.getAttribute('data-type');
      const url = currentVideoUrl();
      if (!url || (downloadType !== 'audio' && downloadType !== 'video')) return;
      inner.classList.remove('is-expanded');
      gifBtn.setAttribute('aria-expanded', 'false');
      chrome.runtime.sendMessage({ type: 'NEKOLOAD_SEND', url, downloadType }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn('Nekoload:', chrome.runtime.lastError.message);
          return;
        }
        if (!res || !res.ok) {
          console.warn('Nekoload: app did not accept the request (is Nekoload running?)');
        }
      });
    });

    document.addEventListener('click', onDocClick, true);
    const onFullscreen = () => setFullscreenHidden(isFullscreenNow());
    document.addEventListener('fullscreenchange', onFullscreen, true);
    removeFullscreenListener = () => document.removeEventListener('fullscreenchange', onFullscreen, true);
    setFullscreenHidden(isFullscreenNow());
  }

  function onDocClick(e) {
    if (!root || root.contains(e.target)) return;
    const inner = root.querySelector('.nekoload-float-inner');
    const gifBtn = root.querySelector('.nekoload-float-gif');
    if (inner) inner.classList.remove('is-expanded');
    if (gifBtn) gifBtn.setAttribute('aria-expanded', 'false');
  }

  function unmount() {
    if (!root) return;
    document.removeEventListener('click', onDocClick, true);
    if (removeFullscreenListener) {
      removeFullscreenListener();
      removeFullscreenListener = null;
    }
    root.remove();
    root = null;
  }

  function sync() {
    if (isVideoPage()) mount();
    else unmount();
  }

  setInterval(sync, 900);
  window.addEventListener('popstate', sync);
  document.addEventListener('yt-navigate-finish', sync);
  sync();
})();
