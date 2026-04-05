(function () {
  const FLOAT_ID = 'nekoload-yt-float';
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

  function fallbackIconUrl() {
    try {
      return chrome.runtime.getURL('icon128.png');
    } catch (_) {
      return chrome.runtime.getURL('icon.png');
    }
  }

  function mount() {
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

    const inner = root.querySelector('.nekoload-float-inner');
    const gifBtn = root.querySelector('.nekoload-float-gif');
    const img = root.querySelector('.nekoload-float-gif img');
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

    gifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
