const path = require('path');

/**
 * Patch the Windows exe icon + version resources without electron-builder's
 * signAndEditExecutable path (that path downloads winCodeSign.7z which can fail
 * if the machine cannot create symlinks).
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const { rcedit } = await import('rcedit');
  const projectDir = context.packager.projectDir;
  const appInfo = context.packager.appInfo;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(projectDir, 'src', 'renderer', 'SIcon.ico');

  const ver = (appInfo.version || '1.0.0').replace(/-/g, '.');
  const description = 'Nekoload - YouTube downloader for Windows.';
  const copyright = 'Copyright © Sekaide Studio';

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: description,
      ProductName: appInfo.productName,
      LegalCopyright: copyright,
      CompanyName: 'Sekaide Studio',
      LegalTrademarks: 'Nekoload',
      InternalName: 'Nekoload',
      OriginalFilename: exeName,
    },
    'file-version': ver,
    'product-version': ver,
  });
};
