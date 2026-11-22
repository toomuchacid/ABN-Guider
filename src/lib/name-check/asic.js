import { asicBusinessNamesUrl } from './official-links.js';
import { withCache } from './support.js';

/**
 * There is no live ASIC signal in this phase. A later `signal(name)` may
 * return a non-available result. An `available` signal is ignored so a
 * failed or empty lookup cannot turn the row green.
 */
export async function checkBusinessName(name, deps = {}) {
  const checkedAt = (deps.now ? deps.now() : new Date()).toISOString();
  return withCache(deps.cache, 'business-name', name, async () => {
    if (typeof deps.signal === 'function') {
      try {
        const found = await deps.signal(name);
        if (found && found.status && found.status !== 'available') {
          return {
            source: 'business-name',
            href: asicBusinessNamesUrl,
            checkedAt,
            ...found,
            status: found.status,
          };
        }
      } catch {
        return {
          source: 'business-name',
          status: 'error',
          label: 'Check failed',
          detail: 'The ASIC check could not be completed. Search the official business names register. This is not a clearance.',
          href: asicBusinessNamesUrl,
          checkedAt,
        };
      }
    }
    const quoted = String(name || '').trim();
    return {
      source: 'business-name',
      status: 'risk',
      label: 'Search official',
      detail: `No live ASIC signal. Search the official business names register and type “${quoted}” there. This amber row is not a clearance.`,
      href: asicBusinessNamesUrl,
      checkedAt,
    };
  });
}
