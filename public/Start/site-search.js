/* Public site catalogue search for BD Start; never index protected paths. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BDStartSiteSearch = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  function normalized(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function publicEntries(data, base) {
    if (!data || !Array.isArray(data.items) || data.items.length > 10000) {
      throw new Error('Invalid public site catalogue');
    }
    const root = new URL(base);
    if (!['http:', 'https:', 'file:'].includes(root.protocol) || !root.pathname.endsWith('/')) {
      throw new Error('Invalid site root');
    }
    const seen = new Set(), entries = [];
    for (const item of data.items) {
      if (!item || typeof item.url !== 'string' || !item.url.startsWith('/') || item.url.startsWith('//') ||
          item.url.includes('\\') || typeof item.title !== 'string' || !item.title.trim()) continue;
      let url, relative;
      try {
        url = new URL(item.url.slice(1), root);
        if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) continue;
        relative = decodeURIComponent(url.pathname.slice(root.pathname.length)).replace(/\\/g, '/').toLowerCase();
      } catch (_) { continue; }
      relative = relative.split('/').filter(Boolean).join('/');
      if (relative.split('/').includes('..')) continue;
      // These routes are deliberate private shortcuts, not public catalogue results.
      if (/^(?:bd\/o(?:\/|$)|bd\/bbsh(?:[./]|$)|bd\/bd_kardiolog(?:[./]|$)|wl(?:\/|$)|ai8\/ai8-state(?:[./]|$))/.test(relative) ||
          relative.split('/').some(function (part) { return ['private','secret','secrets','vault'].includes(part); })) continue;
      const key = url.pathname.replace(/\/index\.html$/i, '/').replace(/\/+$/, '').toLowerCase() + url.search + url.hash;
      if (seen.has(key)) continue;
      seen.add(key);
      const title = item.title.trim().slice(0, 300);
      const description = typeof item.description === 'string' ? item.description.slice(0, 500) : '';
      const aliases = typeof item.aliases === 'string' ? item.aliases.slice(0, 2000) : '';
      const category = typeof item.category === 'string' ? item.category.slice(0, 100) : '';
      entries.push({url: url.href, title: title, description: description,
        haystack: normalized([title, description, aliases, category, relative].join(' '))});
    }
    return entries;
  }

  function search(entries, query, limit) {
    const q = normalized(String(query || '').slice(0, 120));
    if (!q || !Array.isArray(entries)) return [];
    const words = q.split(/\s+/);
    const max = Number.isInteger(limit) ? Math.max(1, Math.min(limit, 30)) : 12;
    return entries.map(function (entry) {
      if (!words.every(function (word) { return entry.haystack.includes(word); })) return null;
      const title = normalized(entry.title);
      let score = title === q ? 200 : title.startsWith(q) ? 80 : 0;
      for (const word of words) if (title.includes(word)) score += 30;
      return {entry: entry, score: score};
    }).filter(Boolean).sort(function (a, b) {
      return b.score - a.score || a.entry.title.localeCompare(b.entry.title);
    }).slice(0, max).map(function (result) { return result.entry; });
  }

  return Object.freeze({publicEntries: publicEntries, search: search});
});
