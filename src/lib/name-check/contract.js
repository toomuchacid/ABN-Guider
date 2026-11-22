/**
 * Phase 2 adapters (Synergy Wholesale domains, ABN Lookup, IP Australia
 * trade marks, ASIC business names) must return this shape.
 *
 * input name -> normalised result:
 *   { source, status: available|taken|risk|unknown|error, detail, checkedAt }
 *
 * Map upstream failures to `error` or `unknown`. Never report a failure,
 * a timeout, or an empty payload as `available`.
 */

export const NAME_CHECK_STATUSES = ['available', 'taken', 'risk', 'unknown', 'error'];

const ALLOWED = new Set(NAME_CHECK_STATUSES);

export const sourceLabels = {
  'domain:.com.au': '.com.au domain',
  'domain:.au': '.au domain',
  'domain:.com': '.com domain',
  'trade-mark': 'IP Australia trade marks',
  'business-name': 'ASIC business names',
  abn: 'ABN Lookup',
};

/**
 * Green is reserved for a positive available result.
 * Errors, unknowns, and anything unexpected are neutral — never green.
 */
export function toneForStatus(status) {
  if (status === 'available') return 'green';
  if (status === 'risk') return 'amber';
  if (status === 'taken') return 'red';
  return 'neutral';
}

export function labelForSource(source) {
  return sourceLabels[source] || String(source || 'Check');
}

export function normaliseResult(input, now = new Date()) {
  const status = ALLOWED.has(input?.status) ? input.status : 'error';
  const fallback = status === 'error'
    ? 'This check did not return a usable result.'
    : status === 'unknown'
      ? 'This check did not produce a result.'
      : '';
  const detail = typeof input?.detail === 'string' && input.detail.trim() ? input.detail.trim() : fallback;
  const checkedAt = typeof input?.checkedAt === 'string' && input.checkedAt ? input.checkedAt : now.toISOString();
  return {
    source: typeof input?.source === 'string' && input.source.trim() ? input.source.trim() : 'unknown',
    status,
    detail,
    checkedAt,
  };
}

/**
 * Overall tone is green only when every row is available.
 * A single error or unknown keeps the summary off green.
 */
export function summariseResults(results) {
  const statuses = results.map((result) => result.status);
  const incomplete = statuses.some((status) => status === 'error' || status === 'unknown');
  if (statuses.some((status) => status === 'taken')) {
    return {
      tone: 'red',
      status: 'taken',
      headline: 'A match turned up',
      detail: incomplete
        ? 'At least one register already shows this name, and another check did not finish. Do not treat unfinished rows as available.'
        : 'At least one check found a matching record. Read the rows before you spend money on a name.',
    };
  }
  if (incomplete) {
    return {
      tone: 'neutral',
      status: statuses.includes('error') ? 'error' : 'unknown',
      headline: 'Not a clear result',
      detail: 'One or more checks failed or could not be completed. That is not a green light. Treat those sources as unchecked.',
    };
  }
  if (statuses.some((status) => status === 'risk')) {
    return {
      tone: 'amber',
      status: 'risk',
      headline: 'Something similar turned up',
      detail: 'No exact match was marked taken, but a similar name or partial issue needs a closer look. This is not a clearance.',
    };
  }
  if (results.length > 0 && statuses.every((status) => status === 'available')) {
    return {
      tone: 'green',
      status: 'available',
      headline: 'No exact match in these checks',
      detail: 'Every connected check came back available. That is not a guarantee you can register or protect the name.',
    };
  }
  return {
    tone: 'neutral',
    status: 'unknown',
    headline: 'No usable checks',
    detail: 'Nothing completed, so there is no green result to show.',
  };
}
