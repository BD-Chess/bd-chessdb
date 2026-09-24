/* 8Z Trip PWA · travel view v1. Route is copied by an explicit action in PWA. */
(function () {
  'use strict';
  const ROUTE_KEY = '8z_trip_pwa_travel_route_v1';
  const PROGRESS_KEY = '8z_trip_pwa_travel_progress_v1';
  const $ = id => document.getElementById(id);
  const words = {
    en: {
      back: 'Trip PWA', title: 'On the road', emptyTitle: 'No route saved for travel',
      emptyBody: 'Optimize a trip in the PWA, then choose “On the road” from its route results.',
      planRoute: 'Plan a route', next: 'Next stop', current: 'Current stop',
      navigationNote: 'Navigation opens from your current location. Check the destination before setting off.',
      apple: 'Open Apple Maps ↗', google: 'Open Google Maps ↗', previous: '← Previous stop',
      visited: 'Mark stop visited ✓', stops: 'Stops', backToPlan: '← Back to Trip PWA',
      clear: 'Remove travel route', localInfo: 'Route and visited stops stay in this browser. No live location tracking runs here.',
      offlineInfo: 'This route is saved on this device. Maps may need an internet connection.',
      methodInfo: 'Stop order uses straight-line distances. Maps chooses the road or walking route to each stop.',
      drive: 'Driving', walk: 'Walking', round: 'Round trip', point: 'One way', saved: 'Saved',
      step: 'Stop {n} of {total}', done: 'Trip complete', complete: 'All stops visited',
      visitedStatus: 'Visited', nextStatus: 'Next', startStatus: 'Start', returnStatus: 'Return to start',
      count: '{n} stops', saveWarning: 'Progress could not be saved in this browser. Keep this page open.',
      removeConfirm: 'Remove the saved travel route and visited-stop progress from this browser?'
    },
    sl: {
      back: 'Trip PWA', title: 'Na poti', emptyTitle: 'Ni shranjene poti za uporabo na poti',
      emptyBody: 'V PWA optimiziraj pot in nato pri rezultatih izberi »Na poti«.',
      planRoute: 'Načrtuj pot', next: 'Naslednja postaja', current: 'Trenutna postaja',
      navigationNote: 'Navigacija začne na tvoji trenutni lokaciji. Pred odhodom preveri cilj.',
      apple: 'Odpri Apple Maps ↗', google: 'Odpri Google Maps ↗', previous: '← Prejšnja postaja',
      visited: 'Označi kot obiskano ✓', stops: 'Postaje', backToPlan: '← Nazaj v Trip PWA',
      clear: 'Odstrani shranjeno pot', localInfo: 'Pot in obiskane postaje ostanejo v tem brskalniku. Tu ni sledenja lokaciji v živo.',
      offlineInfo: 'Pot je shranjena na tej napravi. Zemljevidi morda potrebujejo internet.',
      methodInfo: 'Vrstni red temelji na zračni razdalji. Maps izbere cestno ali peš pot do posamezne postaje.',
      drive: 'Vožnja', walk: 'Hoja', round: 'Krožna pot', point: 'Enosmerna pot', saved: 'Shranjeno',
      step: 'Postaja {n} od {total}', done: 'Pot zaključena', complete: 'Vse postaje obiskane',
      visitedStatus: 'Obiskano', nextStatus: 'Naslednja', startStatus: 'Začetek', returnStatus: 'Vrnitev na začetek',
      count: '{n} postaj', saveWarning: 'Napredka ni mogoče shraniti v tem brskalniku. Pusti stran odprto.',
      removeConfirm: 'Odstranim shranjeno pot in napredek po postajah iz tega brskalnika?'
    }
  };
  let language = 'en', route = null, sequence = [], routeId = '', nextIndex = 1;
  function t(key, values = {}) {
    return (words[language][key] || words.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  }
  function read(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function savedRoute() {
    let raw;
    try { raw = JSON.parse(read(ROUTE_KEY)); } catch (_) { return null; }
    if (!raw || raw.version !== 1 || raw.source !== 'pwa' || !Number.isSafeInteger(raw.savedAt) ||
        raw.savedAt <= 0 || !Number.isFinite(new Date(raw.savedAt).getTime()) ||
        !['DRIVING', 'WALKING'].includes(raw.mode) ||
        typeof raw.roundTrip !== 'boolean' || !Array.isArray(raw.stops) ||
        raw.stops.length < 2 || raw.stops.length > 250) return null;
    const stops = raw.stops.map(p => {
      if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 500 ||
          ((p.lat !== null || p.lon !== null) &&
           (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) ||
            Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180))) return null;
      return {name:p.name.trim(), lat:p.lat, lon:p.lon};
    });
    return stops.includes(null) ? null : {...raw, stops};
  }
  function signature(data) {
    // A route replacement always starts fresh, even if it has the same stop count.
    const value = JSON.stringify([data.savedAt, data.mode, data.roundTrip, data.stops]);
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return `${data.savedAt}:${(hash >>> 0).toString(16)}`;
  }
  function loadProgress() {
    try {
      const saved = JSON.parse(read(PROGRESS_KEY));
      if (saved?.version === 1 && saved.routeId === routeId && Number.isInteger(saved.nextIndex) &&
          saved.nextIndex >= 1 && saved.nextIndex <= sequence.length) nextIndex = saved.nextIndex;
    } catch (_) { /* Start from the first leg if local storage is unavailable. */ }
  }
  function saveProgress() {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({version:1, routeId, nextIndex}));
      $('saveWarning').hidden = true;
    } catch (_) {
      $('saveWarning').textContent = t('saveWarning');
      $('saveWarning').hidden = false;
    }
  }
  function mapLinks(target) {
    // No origin: the map application may use the person's present location.
    const destination = target.lat !== null
      ? `${target.lat.toFixed(6)},${target.lon.toFixed(6)}`
      : encodeURIComponent(target.name);
    $('appleLink').href = `https://maps.apple.com/?daddr=${destination}&dirflg=${route.mode === 'DRIVING' ? 'd' : 'w'}`;
    $('googleLink').href = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${route.mode === 'DRIVING' ? 'driving' : 'walking'}`;
  }
  function drawStops() {
    const list = $('stopList');
    const fragment = document.createDocumentFragment();
    sequence.forEach((stop, i) => {
      const item = document.createElement('li');
      if (i === sequence.length - 1 && route.roundTrip) item.classList.add('return');
      if (i < nextIndex) item.classList.add('visited');
      else if (i === nextIndex) item.classList.add('current');
      const name = document.createElement('span');
      name.textContent = stop.name;
      const status = document.createElement('small');
      status.textContent = i === 0 ? t('startStatus') :
        i === nextIndex && i < sequence.length ? t('nextStatus') :
        i < nextIndex ? t('visitedStatus') :
        i === sequence.length - 1 && route.roundTrip ? t('returnStatus') : '';
      item.append(name, status);
      fragment.append(item);
    });
    list.replaceChildren(fragment);
  }
  function render() {
    if (!route) return;
    const completed = nextIndex === sequence.length;
    $('mode').textContent = `${t(route.mode === 'DRIVING' ? 'drive' : 'walk')} · ${t(route.roundTrip ? 'round' : 'point')}`;
    $('savedInfo').textContent = `${t('saved')}: ${new Date(route.savedAt).toLocaleString(language === 'sl' ? 'sl-SI' : 'en-US')}`;
    $('stopCount').textContent = t('count', {n:route.stops.length});
    $('progress').textContent = completed ? t('done') : t('step', {n:nextIndex, total:sequence.length - 1});
    $('currentPlace').textContent = sequence[completed ? sequence.length - 1 : nextIndex - 1].name;
    $('nextPlace').textContent = completed ? t('complete') : sequence[nextIndex].name;
    $('navigation').hidden = completed;
    $('navigationNote').hidden = completed;
    $('visited').disabled = completed;
    $('previous').disabled = nextIndex <= 1;
    if (!completed) mapLinks(sequence[nextIndex]);
    drawStops();
  }
  function renderLanguage(lang) {
    language = lang === 'sl' ? 'sl' : 'en';
    document.documentElement.lang = language;
    document.title = `8Z Trip · ${t('title')}`;
    document.querySelectorAll('[data-t]').forEach(element => { element.textContent = t(element.dataset.t); });
    document.querySelectorAll('[data-lang]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.lang === language));
    });
    if (!$('saveWarning').hidden) $('saveWarning').textContent = t('saveWarning');
    render();
  }
  function fallbackLanguage() {
    if (window.MDLxDCCLocale?.current) return window.MDLxDCCLocale.current();
    try {
      const preference = JSON.parse(read('mdlxdcc-locale-v1'));
      if (preference?.lang === 'en' || preference?.lang === 'sl') return preference.lang;
    } catch (_) {}
    return read('mdlxdcc-lang') === 'sl' ? 'sl' : 'en';
  }
  function init() {
    route = savedRoute();
    if (route) {
      sequence = route.stops.slice();
      if (route.roundTrip) sequence.push(route.stops[0]);
      routeId = signature(route);
      loadProgress();
      $('travel').hidden = false;
      $('empty').hidden = true;
    } else {
      $('empty').hidden = false;
      $('travel').hidden = true;
    }
    if (window.MDLxDCCLocale?.subscribe) window.MDLxDCCLocale.subscribe(renderLanguage);
    else renderLanguage(fallbackLanguage());
    document.querySelectorAll('[data-lang]').forEach(button => {
      button.addEventListener('click', () => {
        if (window.MDLxDCCLocale?.choose) window.MDLxDCCLocale.choose(button.dataset.lang);
        else {
          try { localStorage.setItem('mdlxdcc-lang', button.dataset.lang); } catch (_) {}
          renderLanguage(button.dataset.lang);
        }
      });
    });
    $('visited').addEventListener('click', () => {
      if (nextIndex >= sequence.length) return;
      nextIndex++;
      saveProgress();
      render();
    });
    $('previous').addEventListener('click', () => {
      if (nextIndex <= 1) return;
      nextIndex--;
      saveProgress();
      render();
    });
    $('clear').addEventListener('click', () => {
      if (!window.confirm(t('removeConfirm'))) return;
      try {
        localStorage.removeItem(ROUTE_KEY);
        localStorage.removeItem(PROGRESS_KEY);
      } catch (_) {
        $('saveWarning').textContent = t('saveWarning');
        $('saveWarning').hidden = false;
        return;
      }
      route = null;
      $('travel').hidden = true;
      $('empty').hidden = false;
    });
    const updateConnection = () => { $('connectionInfo').hidden = navigator.onLine !== false; };
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    updateConnection();
    window.addEventListener('pageshow', () => {
      // The optimizer may have replaced the route while this page was in the back stack.
      const current = savedRoute();
      if ((current ? signature(current) : '') !== routeId) {
        route = current;
        sequence = route ? route.stops.concat(route.roundTrip ? [route.stops[0]] : []) : [];
        routeId = route ? signature(route) : '';
        nextIndex = 1;
        if (route) loadProgress();
        $('empty').hidden = Boolean(route);
        $('travel').hidden = !route;
        render();
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
