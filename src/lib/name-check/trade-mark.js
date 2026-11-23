import { tradeMarkSearchUrl } from './official-links.js';
import { CheckTimeout, fetchWithTimeout, secretMissing, withCache } from './support.js';

const TOKEN_URL = 'https://test.api.ipaustralia.gov.au/public/external-token-api/v1/access_token';
const SEARCH_URL = 'https://test.api.ipaustralia.gov.au/public/australian-trade-mark-search-api/v1/search/quick';

export function tradeMarkMatchCount(payload) {
  if (Array.isArray(payload)) return payload.length;
  if (!payload || typeof payload !== 'object') return null;
  for (const key of ['tradeMarkIds', 'tradeMarks', 'results', 'items', 'numbers', 'ipRightIdentifiers']) {
    if (Array.isArray(payload[key])) return payload[key].length;
  }
  if (typeof payload.count === 'number') return payload.count;
  if (typeof payload.total === 'number') return payload.total;
  if (typeof payload.totalCount === 'number') return payload.totalCount;
  return null;
}

function linkRow(name, partial, checkedAt) {
  return {
    source: 'trade-mark',
    href: tradeMarkSearchUrl(name),
    checkedAt,
    ...partial,
  };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function checkTradeMark(name, deps) {
  const checkedAt = (deps.now ? deps.now() : new Date()).toISOString();
  const clientId = typeof deps.clientId === 'string' ? deps.clientId.trim() : '';
  const clientSecret = typeof deps.clientSecret === 'string' ? deps.clientSecret.trim() : '';
  const testEnv = deps.envName === 'test';
  if (!testEnv || secretMissing(clientId) || secretMissing(clientSecret)) {
    const why = !testEnv && !secretMissing(clientId)
      ? 'The trade mark API is only used when IPA_ENV is test. '
      : '';
    return linkRow(name, {
      status: 'risk',
      label: 'Search official',
      detail: `${why}Live trade mark search is not connected. Open the official Australian Trade Mark Search. The name is in the link. This is not a clearance.`,
    }, checkedAt);
  }

  return withCache(deps.cache, 'trade-mark', name, async () => {
    const failed = (detail) => linkRow(name, {
      status: 'error',
      label: 'Check failed',
      detail,
    }, checkedAt);
    try {
      await deps.sleep?.(deps.gapMs || 0);
      const tokenResponse = await fetchWithTimeout(deps.fetchImpl, TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }, deps.timeoutMs);
      const tokenPayload = tokenResponse.ok ? await readJson(tokenResponse) : null;
      const token = tokenPayload?.access_token;
      if (typeof token !== 'string' || token.length < 8) {
        return failed('The trade mark search could not be authorised. Use the official search. This is not a clearance.');
      }
      await deps.sleep?.(deps.gapMs || 0);
      const searchResponse = await fetchWithTimeout(deps.fetchImpl, SEARCH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: name,
          filters: { quickSearchType: ['WORD'] },
        }),
      }, deps.timeoutMs);
      if (!searchResponse.ok) {
        return failed('The trade mark search did not answer. Use the official search. This is not a clearance.');
      }
      const count = tradeMarkMatchCount(await readJson(searchResponse));
      if (count == null) {
        return failed('The trade mark search did not return a result we could read. Use the official search. This is not a clearance.');
      }
      if (count > 0) {
        return linkRow(name, {
          status: 'risk',
          label: 'Matches to read',
          detail: 'The test trade mark search returned matches. Read them on the official search. This is not legal advice and not a clearance.',
        }, checkedAt);
      }
      return linkRow(name, {
        status: 'risk',
        label: 'No word match',
        detail: 'The test trade mark search returned no word matches. This is not a clearance. Confirm on the official search.',
      }, checkedAt);
    } catch (error) {
      const timedOut = error instanceof CheckTimeout || error?.name === 'CheckTimeout';
      return failed(timedOut
        ? 'The trade mark search did not answer in time. Use the official search. This is not a clearance.'
        : 'The trade mark search could not be completed. Use the official search. This is not a clearance.');
    }
  });
}
