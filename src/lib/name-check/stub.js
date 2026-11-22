/**
 * TODO(phase-2): replace this stub with live adapters.
 * The rows are fake on purpose and include an error and an unknown so the
 * UI cannot be read as a real clearance.
 */
export function stubAdapters(now = new Date()) {
  const checkedAt = now.toISOString();
  return [
    {
      source: 'domain:.com.au',
      async check(name) {
        return {
          source: 'domain:.com.au',
          status: 'taken',
          detail: `Sample only: the mock .com.au register shows an exact match for “${name}”. Live domain checks are not connected.`,
          checkedAt,
        };
      },
    },
    {
      source: 'domain:.au',
      async check(name) {
        return {
          source: 'domain:.au',
          status: 'available',
          detail: `Sample only: the mock .au check found no exact match for “${name}”. This is not a live result and not a promise the name is free.`,
          checkedAt,
        };
      },
    },
    {
      source: 'domain:.com',
      async check(name) {
        return {
          source: 'domain:.com',
          status: 'risk',
          detail: `Sample only: a similar .com turned up near “${name}”. Live domain checks are not connected.`,
          checkedAt,
        };
      },
    },
    {
      source: 'trade-mark',
      async check() {
        return {
          source: 'trade-mark',
          status: 'unknown',
          detail: 'Sample only: IP Australia trade mark search is not connected yet (TODO Phase 2).',
          checkedAt,
        };
      },
    },
    {
      source: 'business-name',
      async check() {
        return {
          source: 'business-name',
          status: 'error',
          detail: 'Sample only: the ASIC business-name check did not run. This failed check is not a green light (TODO Phase 2).',
          checkedAt,
        };
      },
    },
  ];
}
