/* BD Start local data contract. No data is sent to a server. */
(function (scope) {
  'use strict';
  const KEY = 'bd-start-v1';
  const groups = ['daily', 'lab', 'markets'];
  const panels = ['bs-links-panel', 'bs-agenda-panel', 'bs-news-panel', 'bs-weather-panel', 'bs-note-panel', 'bs-reading-panel', 'bs-more-panel', 'bs-data-panel'];
  const fail = () => { throw new Error('invalidData'); };
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= '2100-12-31';
  }
  function url(value) {
    if (typeof value !== 'string' || value.length > 2048) fail();
    let u; try { u = new URL(value); } catch (_) { fail(); }
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) fail();
    return u.href;
  }
  function string(value, max, empty) {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail();
    return value;
  }
  function normalize(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || input.version !== 1) fail();
    const p = input.preferences;
    if (!p || typeof p !== 'object' || Array.isArray(p)) fail();
    const enums = { lang: ['en', 'sl'], theme: ['light', 'dark'], mode: ['overview', 'focus', 'all'], linkGroup: groups, newsGroup: ['world', 'local', 'science'], city: ['Ljubljana', 'Maribor', 'Koper', 'Celje'] };
    const preferences = {};
    for (const [key, values] of Object.entries(enums)) { if (!values.includes(p[key])) fail(); preferences[key] = p[key]; }
    if (!Number.isInteger(p.scale) || p.scale < 90 || p.scale > 140 || p.scale % 10) fail();
    preferences.scale = p.scale;
    if (!date(p.calendarDate)) fail(); preferences.calendarDate = p.calendarDate;
    if (typeof p.calendarMonth !== 'string' || !/^\d{4}-\d{2}$/.test(p.calendarMonth) || !date(p.calendarMonth + '-01')) fail();
    preferences.calendarMonth = p.calendarMonth;
    if (!p.openPanels || typeof p.openPanels !== 'object' || Array.isArray(p.openPanels)) fail();
    preferences.openPanels = {};
    for (const id of panels) { if (typeof p.openPanels[id] !== 'boolean') fail(); preferences.openPanels[id] = p.openPanels[id]; }
    const links = {};
    if (!input.links || typeof input.links !== 'object' || Array.isArray(input.links)) fail();
    for (const group of groups) {
      const list = input.links[group]; if (!Array.isArray(list) || list.length > 300) fail();
      links[group] = list.map(link => {
        if (!Array.isArray(link) || link.length !== 3) fail();
        return [string(link[0], 80, false), url(link[1]), string(link[2], 4, false)];
      });
    }
    if (!Array.isArray(input.events) || input.events.length > 1000) fail();
    const eventIds = new Set();
    const events = input.events.map(event => {
      if (!event || typeof event !== 'object' || Array.isArray(event)) fail();
      const id = string(event.id, 80, false); if (eventIds.has(id)) fail(); eventIds.add(id);
      if (!date(event.date) || typeof event.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) fail();
      return { id, title: string(event.title, 100, false), date: event.date, time: event.time };
    });
    const notes = string(input.notes, 100000, true);
    const ids = /^(w|l|s)[1-4]$/;
    if (!Array.isArray(input.saved) || input.saved.length > 12 || input.saved.some(id => typeof id !== 'string' || !ids.test(id))) fail();
    const result = { version: 1, preferences, links, events, notes, saved: [...new Set(input.saved)] };
    if (input.revision !== undefined) result.revision = string(input.revision, 80, false);
    if (input.updatedAt !== undefined) result.updatedAt = string(input.updatedAt, 40, false);
    return result;
  }
  function parse(text) { if (typeof text !== 'string' || text.length > 2000000) fail(); return normalize(JSON.parse(text)); }
  const api = Object.freeze({ KEY, panels, date, url, normalize, parse });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else scope.BDStartState = api;
})(typeof window === 'object' ? window : globalThis);
