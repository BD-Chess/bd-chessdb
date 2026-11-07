// Failed restore must not turn the next automatic save into data loss.
let nativeRecoveryBlocked = false;
function nativeRecovery(error) {
  nativeRecoveryBlocked = true;
  stopTimer(); clearTimeout(saveTimer);
  storageWarning = 'Saved data retained. Recovery needed: ' + error.message;
  updateMemory();
  openDialog('Saved game needs recovery', '<p>Your saved data was kept unchanged. Export a recovery copy before deciding to discard the unreadable game.</p><p id="nativeRecoveryReason"></p><button class="btn" id="nativeRecoveryExport">Export recovery data</button><button class="btn" id="nativeRecoveryKeep">Keep data and close</button><button class="btn rose" id="nativeRecoveryDiscard">Discard invalid save</button>');
  $('nativeRecoveryReason').textContent = error.message;
  $('nativeRecoveryExport').onclick = () => {
    const records = {};
    for (let i=0; i<localStorage.length; i++) {
      const k=localStorage.key(i); if(k?.startsWith(NS+'.')) records[k]=localStorage.getItem(k);
    }
    download(JSON.stringify({schema:'8ZSUDOKU_NATIVE_RECOVERY_V1',records},null,2),'8zSudoku_recovery.json','application/json');
  };
  $('nativeRecoveryKeep').onclick = closeDialog;
  $('nativeRecoveryDiscard').onclick = () => {
    if (!confirm('Discard the unreadable saved game on this device? Export a recovery copy first.')) return;
    try { localStorage.removeItem(NS+'.session'); if(localStorage.getItem(NS+'.session')!==null)throw Error('Save remains'); }
    catch(e) { $('nativeRecoveryReason').textContent='Could not discard: '+e.message; return; }
    nativeRecoveryBlocked=false; storageWarning=''; closeDialog(); updateMemory();
  };
}
