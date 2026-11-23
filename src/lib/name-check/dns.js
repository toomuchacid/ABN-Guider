import { CheckTimeout, defaultSleep, domainLabel, fetchWithTimeout, withCache } from './support.js';

export const DOH_URL = 'https://cloudflare-dns.com/dns-query';

const SUFFIXES = [
  ['domain:.com.au', 'com.au'],
  ['domain:.au', 'au'],
  ['domain:.net.au', 'net.au'],
];

/**
 * Cloudflare DNS-over-HTTPS JSON.
 * Status 3 is NXDOMAIN. A parent SOA in Authority is not a registration.
 * Only an answer for this exact host counts as a DNS signal.
 */
export function classifyDns(payload, host) {
  if (!payload || typeof payload.Status !== 'number') return 'error';
  if (payload.Status === 3) return 'absent';
  if (payload.Status !== 0) return 'error';
  const expected = host.toLowerCase();
  const answers = Array.isArray(payload.Answer) ? payload.Answer : [];
  const own = answers.some((row) => String(row?.name || '').replace(/\.$/, '').toLowerCase() === expected);
  return own ? 'registered' : 'absent';
}

async function queryType(host, type, deps) {
  await (deps.sleep || defaultSleep)(deps.gapMs || 0);
  const url = new URL(DOH_URL);
  url.searchParams.set('name', host);
  url.searchParams.set('type', type);
  let response;
  try {
    response = await fetchWithTimeout(deps.fetchImpl, url, {
      headers: { accept: 'application/dns-json' },
    }, deps.timeoutMs);
  } catch (error) {
    if (error instanceof CheckTimeout || error?.name === 'CheckTimeout') throw error;
    return 'error';
  }
  if (!response.ok) return 'error';
  try {
    return classifyDns(await response.json(), host);
  } catch {
    return 'error';
  }
}

/**
 * lookup(host) -> 'registered' | 'absent' | 'error'.
 * Replace this with Synergy Wholesale later. Do not scrape WHOIS.
 */
export async function defaultDnsLookup(host, deps) {
  const ns = await queryType(host, 'NS', deps);
  if (ns === 'registered' || ns === 'error') return ns;
  const soa = await queryType(host, 'SOA', deps);
  if (soa === 'registered' || soa === 'error') return soa;
  return 'absent';
}

function unusable(source) {
  return {
    source,
    status: 'risk',
    label: 'Confirm registrar',
    detail: 'This name does not make a domain label we can look up. Confirm with a registrar. This is not a clearance.',
  };
}

function fromPresence(source, host, presence) {
  if (presence === 'registered') {
    return {
      source,
      status: 'risk',
      label: 'Likely registered',
      detail: `Likely registered. A DNS name-server or start-of-authority record was found for ${host}. This is not a registrar confirmation.`,
    };
  }
  if (presence === 'absent') {
    return {
      source,
      status: 'risk',
      label: 'Confirm registrar',
      detail: `No DNS found, may be available, confirm with a registrar. Nothing was found for ${host}. This is not a clearance.`,
    };
  }
  return {
    source,
    status: 'error',
    label: 'Check failed',
    detail: `The DNS check for ${host} could not be completed. This is not a clearance.`,
  };
}

export async function checkDomains(name, deps) {
  const now = deps.now ? deps.now() : new Date();
  const checkedAt = now.toISOString();
  const label = domainLabel(name);
  const lookup = deps.lookup || ((host) => defaultDnsLookup(host, deps));
  const results = [];
  for (const [source, suffix] of SUFFIXES) {
    if (!label) {
      results.push({ ...unusable(source), checkedAt });
      continue;
    }
    const host = `${label}.${suffix}`;
    results.push(await withCache(deps.cache, source, host, async () => {
      try {
        const presence = await lookup(host, deps);
        return { ...fromPresence(source, host, presence), checkedAt };
      } catch (error) {
        const timedOut = error instanceof CheckTimeout || error?.name === 'CheckTimeout';
        return {
          source,
          status: 'error',
          label: 'Check failed',
          detail: timedOut
            ? `The DNS check for ${host} did not answer in time. This is not a clearance.`
            : `The DNS check for ${host} could not be completed. This is not a clearance.`,
          checkedAt,
        };
      }
    }));
  }
  return results;
}
