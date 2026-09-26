/* Presentation and accessibility helpers for /chess/new/. Chess state stays in 8zc-utils. */
(function () {
  'use strict';
  // Keep archive updates sent before window.load, as well as completed games
  // arriving while the Collection drawer is already open.
  let simulationCollections = [], refreshSimulationCollections = null;
  window.addEventListener('chess-sim-collections', event => {
    if (!Array.isArray(event.detail)) return;
    simulationCollections = event.detail.filter(item => item && typeof item.id === 'string' && typeof item.label === 'string' && Array.isArray(item.games));
    refreshSimulationCollections?.();
  });

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
      let wasOpen = false;
      const reflect = () => {
        const open = panel.classList.contains('open');
        byId(buttonId).setAttribute('aria-expanded', String(open));
        if (open && !wasOpen) {
          // Drawer buttons are near the bottom on phones. Bring the full
          // workspace header into view only after this user action.
          const heading = panel.querySelector('.drawer-heading').getBoundingClientRect();
          if (heading.top < 0 || heading.bottom > window.innerHeight) panel.scrollIntoView({ block: 'start' });
        }
        wasOpen = open;
      };
      new MutationObserver(reflect).observe(panel, { attributes: true, attributeFilter: ['class'] });
      reflect();
    });

    // Use PGN identity, not the workspace's event/status message. The LAB host
    // keeps this current for imports, history navigation, reloads and New game.
    const boardGameTitle = byId('boardGameTitle');
    const host = window.ChessLabHost;
    if (boardGameTitle && host) {
      const known = value => {
        const text = String(value || '').trim();
        return text && !/^(?:[?*.-]+|unknown|white|black|book)$/i.test(text) ? text : '';
      };
      const renderGameTitle = context => {
        const headers = context.headers || {};
        const white = known(headers.White), black = known(headers.Black);
        const title = white && black ? `${white} vs ${black}` : known(headers.Opening) || known(headers.Event);
        boardGameTitle.textContent = title;
        boardGameTitle.hidden = !title;
        boardGameTitle.title = [...new Set([title, known(headers.Event), known(headers.Date)].filter(Boolean))].join(' · ');
      };
      renderGameTitle(host.getContext());
      host.onChange(renderGameTitle);
    }

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
      const useOpening = byId('btnUseTournamentOpening');
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
      const initialCollection = categories.indexOf('ChessBest Top Picks');
      const defaultCollection = initialCollection < 0 ? 'all' : String(initialCollection);
      category.value = defaultCollection;
      const results = document.createElement('div');
      results.className = 'library-result-list';
      results.setAttribute('aria-label', 'Matching games');
      const status = document.createElement('p');
      status.className = 'library-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      panel.append(top, searchLabel, search, categoryLabel, category, results, status, legacy);
      if (useOpening) panel.appendChild(useOpening);
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
              // The curated label explains why this game is a Top Pick; the
              // native option has already cleaned the PGN title as plain text.
              const title = collectionIndex === initialCollection && tags.ChessBestTitle
                ? option.textContent : namedPlayers ? `${tags.White} vs ${tags.Black}` : option.textContent;
              const teaser = collectionIndex === initialCollection
                ? String(tags.ChessBestTeaser || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
                  .replace(/<[^>]*>/g, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220)
                : '';
              const detail = [categories[collectionIndex], teaser || (tags.Event && tags.Event !== title ? tags.Event : ''), tags.Date?.replace(/\.\?\?\.\?\?$/, ''), tags.Result && tags.Result !== '*' ? tags.Result : ''].filter(Boolean).join(' · ');
              entry = { option, select, collectionIndex, collectionKey: String(collectionIndex), title, detail, search: normalize(`${title} ${detail} ${tags.Opening || ''} ${tags.ECO || ''} ${option.textContent}`) };
              entryCache.set(option, entry);
            }
            entries.push(entry);
          }
        });
        for (const collection of simulationCollections) {
          for (const game of collection.games) {
            if (!game || !['string', 'number'].includes(typeof game.id) || typeof game.pgn !== 'string') continue;
            const tags = {};
            for (const match of game.pgn.slice(0, 5000).matchAll(/^\[(\w+)\s+"([^"\n]*)"\]\s*$/gm)) tags[match[1]] = match[2];
            const title = game.label || (tags.White && tags.Black ? `${tags.White} vs ${tags.Black}` : 'Simulation game');
            const detail = [collection.label, tags.Event, tags.Date, tags.Result && tags.Result !== '*' ? tags.Result : '', game.state || ''].filter(Boolean).join(' · ');
            entries.push({ simulationId: String(game.id), collectionKey: 'sim:' + collection.id, title, detail,
              search: normalize(`${title} ${detail} ${tags.Opening || ''} ${tags.ECO || ''}`) });
          }
        }
        render();
      };
      const render = () => {
        const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
        const matches = entries.filter(entry => (category.value === 'all' || entry.collectionKey === category.value) && terms.every(term => entry.search.includes(term)));
        count.textContent = category.value === 'all'
          ? `${entries.length.toLocaleString()} games`
          : `${matches.length.toLocaleString()} of ${entries.length.toLocaleString()} games`;
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
            if (entry.simulationId != null) {
              window.dispatchEvent(new CustomEvent('chess-sim-open-game', { detail: { id: entry.simulationId } }));
            } else {
              entry.select.value = entry.option.value;
              entry.select.dispatchEvent(new Event('change', { bubbles: true }));
            }
            byId('first').focus({ preventScroll: true });
          });
          fragment.appendChild(button);
        });
        results.appendChild(fragment);
        status.textContent = matches.length > 60 ? `Showing 60 of ${matches.length.toLocaleString()} matches. Refine your search to see more.` : matches.length ? `${matches.length.toLocaleString()} ${matches.length === 1 ? 'game' : 'games'} found. Select a game to load it.` : initialLoad && category.value === defaultCollection && !search.value ? 'Loading Top Picks…' : entries.length ? 'No games match. Try another player, year or collection.' : initialLoad ? 'Loading game collections…' : 'No collections loaded. Use Load PGN to open a game from your device.';
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
      refreshSimulationCollections = () => {
        const selected = category.value;
        category.querySelectorAll('[data-sim-collection]').forEach(option => option.remove());
        for (const collection of simulationCollections) {
          const option = new Option(collection.label, 'sim:' + collection.id);
          option.dataset.simCollection = collection.id; category.appendChild(option);
        }
        category.value = Array.from(category.options).some(option => option.value === selected) ? selected : defaultCollection;
        indexGames();
      };
      refreshSimulationCollections();
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
