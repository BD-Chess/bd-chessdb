export const PAIR_REQUESTS = 'guiRequests';
export function pendingRequests(value, now = Date.now()) {
  return (Array.isArray(value) ? value : []).filter(r => Number.isInteger(r.id) && r.createdAt > now - 600000 &&
    /^https:\/\/www\.mdlxdcc\.org\/omnicpq\/(?:index\.html)?$/i.test(r.url || '')).slice(-9);
}
