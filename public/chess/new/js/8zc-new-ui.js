/* Presentation and accessibility helpers for /chess/new/. Chess state stays in 8zc-utils. */
(function () {
  'use strict';

  function start() {
    const byId = id => document.getElementById(id);
    const whatsNew = byId('whatsNewDialog');
    const openWhatsNew = byId('btnWhatsNew');
    openWhatsNew.addEventListener('click', () => whatsNew.showModal());
    const closeWhatsNew = () => { whatsNew.close(); openWhatsNew.focus(); };
    byId('btnCloseWhatsNew').addEventListener('click', closeWhatsNew);
    byId('btnStartExploring').addEventListener('click', closeWhatsNew);
    whatsNew.addEventListener('click', event => {
      if (event.target !== whatsNew) return;
      const rect = whatsNew.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeWhatsNew();
    });
    whatsNew.addEventListener('close', () => openWhatsNew.focus());
    byId('btnPlayBest').addEventListener('click', () => byId('bestMoveLink').click());
    byId('bestMoveLink').addEventListener('keydown', event => {
      if (event.key === ' ') { event.preventDefault(); byId('bestMoveLink').click(); }
    });

    // Keep the board library's internal square geometry synchronized with CSS.
    let resizeFrame = 0;
    const resizeBoard = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => window.dispatchEvent(new Event('8zc:resize')));
    };
    if ('ResizeObserver' in window) new ResizeObserver(resizeBoard).observe(byId('board'));
    else window.addEventListener('resize', resizeBoard);
    resizeBoard();

    // Reflect panels opened by the existing application handlers.
    [['btnGames', 'popularGamesPanel'], ['btnSettings', 'settingsPanel']].forEach(([buttonId, panelId]) => {
      const panel = byId(panelId);
      const reflect = () => byId(buttonId).setAttribute('aria-expanded', String(panel.classList.contains('open')));
      new MutationObserver(reflect).observe(panel, { attributes: true, attributeFilter: ['class'] });
      reflect();
    });

    setupLibrary();
    setupModalKeyboard();

    function setupLibrary() {
      const panel = byId('popularGamesPanel');
      const nativeSelects = Array.from(panel.querySelectorAll('select'));
      if (!nativeSelects.length) return;
      const legacy = document.createElement('div');
      legacy.className = 'library-native-selects';
      legacy.hidden = true;
      nativeSelects.forEach(select => legacy.appendChild(select));
      const drawerHeader = panel.querySelector('.drawer-heading');
      panel.replaceChildren();
      if (drawerHeader) panel.appendChild(drawerHeader);
      const top = document.createElement('div');
      top.className = 'library-title';
      top.append(document.createTextNode('Find your next game'));
      const count = document.createElement('span');
      count.className = 'library-count';
      top.appendChild(count);
      const searchLabel = document.createElement('label');
      searchLabel.className = 'library-field-label';
      searchLabel.htmlFor = 'gameLibrarySearch';
      searchLabel.textContent = 'Search players, openings, events or years';
      const search = document.createElement('input');
      search.id = 'gameLibrarySearch';
      search.type = 'search';
      search.placeholder = 'Try Carlsen, Sicilian, 2024…';
      search.autocomplete = 'off';
      const categoryLabel = document.createElement('label');
      categoryLabel.className = 'library-field-label';
      categoryLabel.htmlFor = 'popularGamesSelect';
      categoryLabel.textContent = 'Collection';
      const category = document.createElement('select');
      category.id = 'popularGamesSelect';
      category.appendChild(new Option('All collections', 'all'));
      const categories = nativeSelects.map((select, index) => {
        const name = (select.options[0]?.textContent || 'Games').replace(/\s*—\s*Select a game.*$/i, '');
        category.appendChild(new Option(name, String(index)));
        return name;
      });
      const results = document.createElement('div');
      results.className = 'library-result-list';
      results.setAttribute('aria-label', 'Matching games');
      const status = document.createElement('p');
      status.className = 'library-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      panel.append(top, searchLabel, search, categoryLabel, category, results, status, legacy);
      const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const entryCache = new WeakMap();
      let entries = [];
      let queued = false;
      let initialLoad = true;
      const indexGames = () => {
        queued = false;
        entries = [];
        nativeSelects.forEach((select, collectionIndex) => {
          for (const option of select.options) {
            if (!option.value) continue;
            let entry = entryCache.get(option);
            if (!entry) {
              const tags = {};
              const header = option.value.slice(0, 5000);
              for (const match of header.matchAll(/^\[(\w+)\s+"([^"\n]*)"\]\s*$/gm)) tags[match[1]] = match[2];
              const namedPlayers = tags.White && tags.Black && tags.White !== 'Book';
              const title = namedPlayers ? `${tags.White} vs ${tags.Black}` : option.textContent;
              const detail = [categories[collectionIndex], tags.Event && tags.Event !== title ? tags.Event : '', tags.Date?.replace(/\.\?\?\.\?\?$/, ''), tags.Result && tags.Result !== '*' ? tags.Result : ''].filter(Boolean).join(' · ');
              entry = { option, select, collectionIndex, title, detail, search: normalize(`${title} ${detail} ${tags.Opening || ''} ${tags.ECO || ''} ${option.textContent}`) };
              entryCache.set(option, entry);
            }
            entries.push(entry);
          }
        });
        render();
      };
      const render = () => {
        const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
        const matches = entries.filter(entry => (category.value === 'all' || String(entry.collectionIndex) === category.value) && terms.every(term => entry.search.includes(term)));
        count.textContent = `${entries.length.toLocaleString()} games`;
        results.replaceChildren();
        const fragment = document.createDocumentFragment();
        matches.slice(0, 60).forEach(entry => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'library-result';
          const title = document.createElement('strong');
          title.textContent = entry.title;
          const detail = document.createElement('span');
          detail.textContent = entry.detail;
          button.append(title, detail);
          button.addEventListener('click', () => {
            entry.select.value = entry.option.value;
            entry.select.dispatchEvent(new Event('change', { bubbles: true }));
            byId('first').focus({ preventScroll: true });
          });
          fragment.appendChild(button);
        });
        results.appendChild(fragment);
        status.textContent = matches.length > 60 ? `Showing 60 of ${matches.length.toLocaleString()} matches. Refine your search to see more.` : matches.length ? `${matches.length.toLocaleString()} ${matches.length === 1 ? 'game' : 'games'} found. Select a game to load it.` : entries.length ? 'No games match. Try another player, year or collection.' : initialLoad ? 'Loading game collections…' : 'No collections loaded. Use Load PGN to open a game from your device.';
      };
      const observer = new MutationObserver(() => {
        if (!queued) { queued = true; requestAnimationFrame(indexGames); }
      });
      nativeSelects.forEach(select => observer.observe(select, { childList: true }));
      search.addEventListener('input', render);
      category.addEventListener('change', render);
      byId('btnGames').addEventListener('click', () => {
        if (panel.classList.contains('open')) search.focus({ preventScroll: true });
      });
      setTimeout(() => { initialLoad = false; if (!entries.length) render(); }, 20000);
      indexGames();
    }

    function setupModalKeyboard() {
      const modals = [{ element: byId('simModal'), close: byId('simCancelBtn') }, { element: byId('replayModal'), close: byId('replayCancel') }];
      let activeModal = null;
      let restoreFocus = null;
      const focusables = element => Array.from(element.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[hidden]'));
      modals.forEach(modal => {
        new MutationObserver(() => {
          const visible = getComputedStyle(modal.element).display !== 'none';
          if (visible && activeModal !== modal) {
            restoreFocus = document.activeElement;
            activeModal = modal;
            requestAnimationFrame(() => focusables(modal.element)[0]?.focus());
          } else if (!visible && activeModal === modal) {
            activeModal = null;
            restoreFocus?.focus({ preventScroll: true });
          }
        }).observe(modal.element, { attributes: true, attributeFilter: ['style'] });
      });
      document.addEventListener('keydown', event => {
        const modalElement = whatsNew.open ? whatsNew : activeModal?.element;
        if (!modalElement) return;
        // Block board navigation while a dialog is open; retain native select keys.
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.stopPropagation();
        if (event.key === 'Escape' && activeModal && !whatsNew.open) {
          event.preventDefault(); event.stopPropagation(); activeModal.close.click();
        }
        if (event.key !== 'Tab') return;
        const items = focusables(modalElement);
        const first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !modalElement.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }, true);
    }
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();
