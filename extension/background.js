async function fetchWithTimeout(endpoint, body, timeoutMs = 400, extraOptions = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      ...extraOptions,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function sendToApp(url, downloadType) {
  const body =
    downloadType === 'audio' || downloadType === 'video'
      ? { url, downloadType }
      : { url };

  const endpoints = ['http://127.0.0.1:3000/url', 'http://localhost:3000/url'];

  for (const endpoint of endpoints) {
    try {
      const res = await fetchWithTimeout(endpoint, body, 8000);
      if (res.ok) {
        return true;
      }
    } catch (err) {
      console.warn('URL send failed for', endpoint, err);
    }
  }

  try {
    await fetchWithTimeout('http://127.0.0.1:3000/url', body, 8000, { mode: 'no-cors' });
    return true;
  } catch (err) {
    console.warn('Fallback no-cors send failed', err);
  }

  return false;
}

function isYouTubeUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'youtu.be' ||
      hostname === 'www.youtu.be' ||
      hostname.includes('youtube.com') ||
      hostname === 'youtube-nocookie.com'
    );
  } catch (_) {
    return false;
  }
}

async function updateActionState(tabId, enable) {
  try {
    if (enable) {
      chrome.action.enable(tabId);
    } else {
      chrome.action.disable(tabId);
    }
  } catch (err) {
    console.warn('Unable to update action state for tab', tabId, err);
  }
}

async function updateIconForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || !isYouTubeUrl(tab.url)) {
      await updateActionState(tabId, false);
      return;
    }
    await updateActionState(tabId, true);
  } catch (err) {
    console.warn('Unable to update action state for tab', err);
  }
}

async function updateIconForActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs.length) {
      await updateIconForTab(tabs[0].id);
    }
  } catch (err) {
    console.warn('Unable to update action state for active tab', err);
  }
}

chrome.tabs.onActivated.addListener((activeInfo) => updateIconForTab(activeInfo.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateIconForTab(tabId);
  }
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    updateIconForActiveTab();
  }
});

updateIconForActiveTab();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'NEKOLOAD_SEND' && msg.url) {
    sendToApp(msg.url, msg.downloadType)
      .then((ok) => {
        if (!ok) {
          chrome.notifications.create('', {
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'Nekoload',
            message: 'Start Nekoload so it can receive this video.',
          });
        }
        sendResponse({ ok: Boolean(ok) });
      })
      .catch(() => {
        sendResponse({ ok: false });
      });
    return true;
  }
  return false;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url) {
    chrome.notifications.create('', {
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Nekoload',
      message: 'No YouTube video detected on the current tab.',
    });
    return;
  }

  try {
    const url = new URL(tab.url);
    const host = url.hostname.toLowerCase();
    const isYouTubeShort = host === 'youtu.be';
    const isYouTubeWatch = host.includes('youtube.com') || host === 'youtube-nocookie.com';
    const isValidYouTube = isYouTubeShort || isYouTubeWatch;
    if (!isValidYouTube) {
      chrome.notifications.create('', {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Nekoload',
        message: 'No YouTube video detected on the current tab.',
      });
      return;
    }

    const sent = await sendToApp(tab.url);
    if (sent) {
      console.log('URL sent to Nekoload:', tab.url);
    } else {
      console.error('Failed to send URL: app is not running or localhost is blocked');
      chrome.notifications.create('', {
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'Nekoload',
        message: 'You have to wake up "Nekoload" in order to download this video',
      });
    }
  } catch (err) {
    console.error('Failed to send URL:', err);
  }
});
