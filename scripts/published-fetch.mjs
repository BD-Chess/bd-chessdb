// Public deployment verification only. Keep non-GET requests and all
// integrity checks outside this bounded recovery for an HTTP 503 response.
import { setTimeout as waitFor } from 'node:timers/promises';

export async function fetchPublished(url, init = {}, { fetcher = fetch, wait = waitFor } = {}) {
  if ((init.method || 'GET').toUpperCase() !== 'GET') throw Error('PUBLISHED_FETCH_GET_ONLY');
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(url, init);
    if (response.status !== 503 || attempt === 2) return response;
    await response.body?.cancel();
    await wait(1000 * (attempt + 1));
  }
}
