import { containsTfnPhrase } from '../privacy/tfn.js';
import { normaliseResult, summariseResults } from './contract.js';
import { stubAdapters } from './stub.js';

export function normaliseQuery(name) {
  if (typeof name !== 'string') return { ok: false, error: 'Enter a business name.' };
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed) return { ok: false, error: 'Enter a business name.' };
  if (trimmed.length > 180) return { ok: false, error: 'That name is too long to check.' };
  if (/[\u0000-\u001F]/.test(trimmed)) return { ok: false, error: 'That name contains characters we can’t check.' };
  if (containsTfnPhrase(trimmed)) return { ok: false, error: 'Enter a business name, not a tax file number.' };
  return { ok: true, name: trimmed };
}

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
