(function () {
  if (!window.nekoloadSettings) return;

  const pathInput = document.getElementById('downloadPathInput');
  const btnSelect = document.getElementById('btnSelectFolder');
  const btnClose = document.getElementById('settingsClose');
  const themeRadios = Array.from(document.querySelectorAll('input[name="theme"]'));
  const opacityRange = document.getElementById('backgroundOpacityRange');
  const opacityValue = document.getElementById('backgroundOpacityValue');

  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.toggle('theme-purple', theme === 'purple');
    root.classList.toggle('theme-cyan', theme === 'cyan');
  }

  function applyOpacity(opacity) {
    if (typeof opacity !== 'number') opacity = parseFloat(opacity);
    if (Number.isNaN(opacity)) return;
    const percent = Math.round(opacity * 100);
    if (opacityRange) opacityRange.value = percent.toString();
    if (opacityValue) opacityValue.textContent = `${percent}%`;
    document.documentElement.style.setProperty('--app-opacity', opacity.toFixed(2));
  }

  async function loadSettings() {
    const [downloadPath, theme, opacity] = await Promise.all([
      window.nekoloadSettings.getDownloadPath(),
      window.nekoloadSettings.getTheme(),
      window.nekoloadSettings.getBackgroundOpacity(),
    ]);

    if (downloadPath) pathInput.value = downloadPath;
    if (theme) {
      themeRadios.forEach((radio) => {
        radio.checked = radio.value === theme;
      });
      applyTheme(theme);
    }
    if (typeof opacity !== 'undefined') {
      applyOpacity(opacity);
    }
  }

  themeRadios.forEach((radio) => {
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      const res = await window.nekoloadSettings.setTheme(radio.value);
      if (res?.ok) {
        applyTheme(radio.value);
      }
    });
  });

  if (opacityRange) {
    opacityRange.addEventListener('input', async () => {
      const opacity = Math.max(0.2, Math.min(1, parseInt(opacityRange.value, 10) / 100));
      applyOpacity(opacity);
      await window.nekoloadSettings.setBackgroundOpacity(opacity);
    });
  }

  btnSelect.addEventListener('click', async () => {
    const selected = await window.nekoloadSettings.selectFolder();
    if (!selected) return;
    const res = await window.nekoloadSettings.setDownloadPath(selected);
    if (res?.ok) {
      pathInput.value = selected;
    }
  });

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      const appEl = document.querySelector('.app');
      if (appEl && !appEl.classList.contains('window-closing')) {
        appEl.classList.add('window-closing');
        setTimeout(() => window.nekoloadSettings.close(), 320);
      } else {
        window.nekoloadSettings.close();
      }
    });
  }

  if (window.nekoloadSettings.onThemeChanged) {
    window.nekoloadSettings.onThemeChanged((theme) => {
      applyTheme(theme);
      themeRadios.forEach((radio) => {
        radio.checked = radio.value === theme;
      });
    });
  }

  if (window.nekoloadSettings.onBackgroundOpacityChanged) {
    window.nekoloadSettings.onBackgroundOpacityChanged((opacity) => {
      applyOpacity(opacity);
    });
  }

  loadSettings();
})();
