import { normaliseResult, summariseResults } from './contract.js';
import { normaliseQuery } from './query.js';
import { stubAdapters } from './stub.js';

export { normaliseQuery };

/**
 * Run adapters and normalise every row. A thrown adapter becomes `error`
 * and can never be painted green by the summary.
 */
export async function runNameCheck(name, adapters = stubAdapters(), now = new Date()) {
  const query = normaliseQuery(name);
  if (!query.ok) {
    const results = [normaliseResult({ source: 'name-check', status: 'error', detail: query.error }, now)];
    return { ok: false, error: query.error, query: '', results, summary: summariseResults(results) };
  }
  const results = [];
  for (const adapter of adapters) {
    try {
      const raw = await adapter.check(query.name);
      const list = Array.isArray(raw) ? raw : [raw];
      if (list.length === 0) {
        results.push(normaliseResult({
          source: adapter.source,
          status: 'error',
          detail: 'This check returned no result.',
        }, now));
      }
      for (const item of list) results.push(normaliseResult(item, now));
    } catch {
      results.push(normaliseResult({
        source: adapter.source || 'unknown',
        status: 'error',
        detail: 'This check could not be completed.',
      }, now));
    }
  }
  return { ok: true, query: query.name, results, summary: summariseResults(results) };
}

/** Contract helper: input name -> list of normalised results. */
export async function checkName(name, adapters = stubAdapters(), now = new Date()) {
  const outcome = await runNameCheck(name, adapters, now);
  return outcome.results;
}
