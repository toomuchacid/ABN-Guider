/**
 * Adapter contract for the live name checks.
 *
 * Each adapter:
 *   { source: string, check: (normalisedName: string) => Promise<NameCheckResult | NameCheckResult[]> }
 *
 * Domain rows use a DNS lookup so Synergy Wholesale can replace that
 * function later. Do not scrape WHOIS.
 *
 * NameCheckResult:
 *   { source, status: 'available' | 'taken' | 'risk' | 'unknown' | 'error', detail, checkedAt }
 *
 * If the upstream call fails, times out, or returns a shape you do not trust,
 * return status `error` or `unknown`. Do not return `available` for those cases.
 * `runNameCheck` also turns a thrown error into status `error`, and the summary
 * stays off green unless every row is `available`.
 */

export const phase2Sources = [
  { source: 'domain:.com.au', provider: 'DNS' },
  { source: 'domain:.au', provider: 'DNS' },
  { source: 'domain:.net.au', provider: 'DNS' },
  { source: 'trade-mark', provider: 'IP Australia' },
  { source: 'business-name', provider: 'ASIC' },
  { source: 'abn', provider: 'ABN Lookup' },
];

export function createAdapter(source, check) {
  return {
    source,
    async check(name) {
      try {
        return await check(name);
      } catch {
        return {
          source,
          status: 'error',
          detail: 'This check could not be completed.',
        };
      }
    },
  };
}
