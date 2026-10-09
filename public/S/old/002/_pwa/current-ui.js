'use strict';
// Presentation adapter around the unchanged stable CURRENT engine.
(() => {
  const $ = id => document.getElementById(id), center = document.querySelector('.col-center');
  document.body.dataset.view = 'play';
  document.querySelector('.title').textContent = '8zSudoku';
  const style = document.createElement('style');
  style.textContent = `[hidden]{display:none!important}.pl-tabs{display:flex;gap:6px;margin:10px auto 12px;padding:4px;border:1px solid var(--border2);border-radius:12px}.title{font-family:system-ui,sans-serif}.pl-tabs .btn{width:auto;flex:0 1 auto;min-width:78px;min-height:42px;font-size:14px;letter-spacing:normal;border-radius:8px}.pl-tabs [aria-pressed=true]{background:var(--cyan-dim);color:var(--cyan)}body:not([data-view=lab]) .main{grid-template-columns:200px minmax(0,1fr) 200px;grid-template-areas:'left center .';max-width:1240px}body:not([data-view=lab]) .col-right,body:not([data-view=lab]) #humanTracePanel,body:not([data-view=lab]) .research-notes,body:not([data-view=lab]) .stats-bar,body[data-view=play] #gameReviewPanel,body:not([data-view=lab]) #coachProfile{display:none!important}.current-status{width:100%;max-width:680px;margin:12px 0 6px;overflow-wrap:anywhere;min-height:1.4em;font:14px/1.5 system-ui;text-align:center}.pl-notice{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;width:100%;margin:6px 0 16px}.pl-notice .btn{width:auto;min-height:40px;font:14px system-ui}#proofCoachPanel{width:100%;max-width:680px;margin:12px 0;font:16px/1.5 system-ui}#proofCoachPanel .btn{min-height:40px;font-size:14px}#currentDialog{width:min(560px,calc(100% - 32px));padding:24px;background:#0b1423;color:#e2e8f4;border:1px solid #547186;border-radius:12px;font:16px/1.6 system-ui}#currentDialog::backdrop{background:#020409d9}#currentDialog button{min-height:42px;margin:6px;padding:8px 14px;background:#172b45;color:#fff;border:1px solid #547186;border-radius:8px;font:inherit}#currentDialog h2{font-size:22px}@media(min-width:761px) and (max-width:840px){body:not([data-view=lab]) .main{grid-template-columns:160px minmax(0,1fr) 160px}}@media(max-width:760px){body:not([data-view=lab]) .main{grid-template-columns:1fr;grid-template-areas:'center' 'left';max-width:500px;padding:6px 10px}.pl-notice .btn{font-size:12px}.pl-tabs{margin:8px auto}}`;
  document.head.append(style);
  document.querySelector('.title-block').insertAdjacentHTML('afterend', '<nav class="pl-tabs" aria-label="Game views"><button class="btn" data-view-button="play" aria-pressed="true">Play</button><button class="btn" data-view-button="learn" aria-pressed="false">Learn</button><button class="btn" data-view-button="lab" aria-pressed="false">Lab</button></nav>');
  const status = $('status'); status.classList.add('current-status'); status.setAttribute('role', 'status');
  const summary = document.createElement('p'); summary.id = 'currentGameStatus'; summary.className = 'current-status'; summary.setAttribute('role','status');
  $('gridWrap').after(status, summary);
  const notice = document.createElement('div'); notice.className = 'pl-notice';
  notice.innerHTML = '<button class="btn" id="currentNews">What’s new</button><button class="btn" id="currentTutorial">Quick tutorial · optional</button>';
  summary.after(notice);
  center.append($('proofCoachPanel')); $('proofCoachPanel').hidden = true;
  const originalStatus = setStatus;
  const simplify = () => {
    const raw = globalThis.SudokuI18n?.original(status) || status.textContent;
    status.hidden = document.body.dataset.view !== 'lab'; summary.hidden = !status.hidden;
    let readable = raw;
    if (/givens.*AI steps/.test(raw)) readable = (currentDiff || '') + ' · Ready to play';
    else if (/Page reload detected|Stored completed trace restored/.test(raw)) readable = (currentDiff || '') + ' · Saved game recovered';
    summary.textContent = readable;
  };
  setStatus = function(text, cls) { originalStatus(text, cls); simplify(); };
  document.querySelectorAll('[data-view-button]').forEach(b => b.addEventListener('click', () => {
    document.body.dataset.view = b.dataset.viewButton;
    document.querySelectorAll('[data-view-button]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $('proofCoachPanel').hidden = b.dataset.viewButton === 'play'; simplify();
  }));
  const dialog = document.createElement('dialog'); dialog.id = 'currentDialog'; document.body.append(dialog);
  function show(title, body) {
    dialog.innerHTML = '<h2>'+title+'</h2>'+body+'<button id="currentDialogClose">Close</button>';
    $('currentDialogClose').onclick = () => dialog.close(); dialog.showModal();
  }
  $('currentNews').onclick = () => show('What’s new', '<p>Install CURRENT directly. Play and Learn keep the board centered. Choose English or Slovenian. Your game is saved before an update. The stable Sudoku engine is unchanged.</p>');
  $('currentTutorial').onclick = () => {
    show('A small practice space','<p>This demonstration does not change your game. Select the square, choose 4, then try Notes and Undo.</p><button id="currentPracticeCell" aria-label="Tutorial cell">·</button><div><button id="currentPracticeNumber">4</button><button id="currentPracticeNotes">Notes</button><button id="currentPracticeUndo">Undo</button></div><p id="currentPracticeStatus">Select the square.</p>');
    let chosen = false, note = false, value = '', history = [];
    $('currentPracticeCell').onclick = () => { chosen = true; $('currentPracticeStatus').textContent = 'Now choose 4.'; };
    $('currentPracticeNumber').onclick = () => { if (!chosen) return; history.push(value); value = note ? 'Note 4' : '4'; $('currentPracticeCell').textContent = value; };
    $('currentPracticeNotes').onclick = () => { note = !note; $('currentPracticeStatus').textContent = note ? 'Notes on' : 'Notes off'; };
    $('currentPracticeUndo').onclick = () => { value = history.pop() || ''; $('currentPracticeCell').textContent = value || '·'; };
  };
  simplify();
})();
