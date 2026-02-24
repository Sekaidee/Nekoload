(function () {
  if (!window.nekoloadSettings) return;

  const pathInput = document.getElementById('downloadPathInput');
  const btnSelect = document.getElementById('btnSelectFolder');
  const btnClose = document.getElementById('settingsClose');

  async function loadPath() {
    const p = await window.nekoloadSettings.getDownloadPath();
    pathInput.value = p || '';
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

  loadPath();
})();
