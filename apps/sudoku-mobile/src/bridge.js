import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const isNative = Capacitor.isNativePlatform();
const safeName = name => String(name).replace(/[^a-z0-9_.-]/gi, '_').slice(0, 100);
// Keep the 9-key pad immediately below the grid on phones; restore the desktop column on tablets.
const phoneLayout = matchMedia('(max-width:760px)');
function placeInputPanel() {
  const panel = document.querySelector('#numpad')?.closest('.panel');
  const grid = document.querySelector('#gridWrap');
  const left = document.querySelector('.col-left');
  if (!panel || !grid || !left) return;
  if (phoneLayout.matches) {
    grid.after(panel);
    panel.classList.add('mobile-input-panel');
  } else {
    left.querySelector('.panel')?.after(panel);
    panel.classList.remove('mobile-input-panel');
  }
}
phoneLayout.addEventListener('change', placeInputPanel);
placeInputPanel();
window.SudokuMobileBridge = {
  isNative,
  async exportFile(text, name, type) {
    if (!isNative) throw Error('Native sharing is unavailable.');
    const file = `export-${Date.now()}-${safeName(name)}`;
    const { uri } = await Filesystem.writeFile({ path: file, data: String(text), directory: Directory.Cache, encoding: 'utf8' });
    try {
      await Share.share({ title: name, text: '8zSudoku local export', url: uri, dialogTitle: `Export ${name}` });
    } finally {
      await Filesystem.deleteFile({ path: file, directory: Directory.Cache }).catch(() => {});
    }
  },
};
if (isNative) {
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) window.SudokuMobileSession?.resume();
    else window.SudokuMobileSession?.pause();
  });
  App.addListener('backButton', () => {
    if (!window.SudokuMobileSession?.back()) App.exitApp();
  });
}
