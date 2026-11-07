import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const isNative = Capacitor.isNativePlatform();
const safeName = name => String(name).replace(/[^a-z0-9_.-]/gi, '_').slice(0, 100);
let exportSequence = 0;
const pendingWrites = new Set();
window.SudokuMobileBridge = {
  isNative,
  async exportFile(text, name, type) {
    if (!isNative) throw Error('Native sharing is unavailable.');
    if (window.SudokuMobileDeleting) throw Error('Local deletion is in progress.');
    const file = `export-${Date.now()}-${++exportSequence}-${safeName(name)}`;
    const writing = Filesystem.writeFile({ path: file, data: String(text), directory: Directory.Cache, encoding: 'utf8' });
    pendingWrites.add(writing);
    let uri;
    try { ({ uri } = await writing); }
    finally { pendingWrites.delete(writing); }
    if (window.SudokuMobileDeleting) throw Error('Export canceled by local deletion.');
    // Android chooser completion does not guarantee the target read the URI.
    // Keep files in the app cache until explicit deletion or OS cache eviction.
    await Share.share({ title: name, text: '8zSudoku local export', url: uri, dialogTitle: `Export ${name}` });
  },
  async deleteExports() {
    if (!isNative) return;
    await Promise.allSettled([...pendingWrites]);
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache });
    for (const file of files) {
      if (/^export-\d+-[a-z0-9_.-]+$/i.test(file.name)) {
        await Filesystem.deleteFile({ path: file.name, directory: Directory.Cache });
      }
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
