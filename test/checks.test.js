import { describe, expect, it } from 'vitest';
import { checkAbn, exactNamesFromAbrXml } from '../src/lib/name-check/abn.js';
import { checkBusinessName } from '../src/lib/name-check/asic.js';
import { checkDomains, classifyDns } from '../src/lib/name-check/dns.js';
import { onRequestPost } from '../functions/api/name-check.js';
import { createMemoryKv } from '../src/lib/kv/memory.js';
import { keys } from '../src/lib/ids.js';
import { safeRegisterHref } from '../src/lib/name-check/contract.js';
import { CheckTimeout } from '../src/lib/name-check/support.js';
import { checkTradeMark, tradeMarkMatchCount } from '../src/lib/name-check/trade-mark.js';
import { entitlementSetCookie, signEntitlementToken } from '../src/lib/payments/entitlement.js';
import { dispatch } from '../worker/index.js';

const GUID = '11111111-2222-4333-8444-555555555555';
const now = () => new Date('2026-11-21T00:00:00.000Z');
const noSleep = async () => {};

function hang(_url, init = {}) {
  return new Promise((_resolve, reject) => {
    const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (init.signal?.aborted) fail();
    else init.signal?.addEventListener('abort', fail, { once: true });
  });
}

function requestUrl(value) {
  return value instanceof URL ? value : new URL(String(value));
}

describe('DNS name signal', () => {
  it('treats an answer for the host as registered and NXDOMAIN as no DNS', () => {
    expect(classifyDns({ Status: 0, Answer: [{ name: 'harbour-and-co.com.au.', type: 2 }] }, 'harbour-and-co.com.au')).toBe('registered');
    expect(classifyDns({ Status: 3, Authority: [{ name: 'com.au.', type: 6 }] }, 'harbour-and-co.com.au')).toBe('absent');
    expect(classifyDns({ Status: 0, Answer: [] }, 'harbour-and-co.com.au')).toBe('absent');
    expect(classifyDns({ Status: 2 }, 'harbour-and-co.com.au')).toBe('error');
  });

  it('never calls a missing host available, including on timeout', async () => {
    const absent = await checkDomains('Harbour & Co', { lookup: async () => 'absent', sleep: noSleep, gapMs: 0, cache: null, now });
    expect(absent.map((row) => row.status)).toEqual(['risk', 'risk', 'risk']);
    expect(absent.every((row) => row.status !== 'available')).toBe(true);
    expect(absent[0].detail.toLowerCase()).toContain('no dns found, may be available, confirm with a registrar');
    expect(absent[0].detail).toContain('harbour-and-co.com.au');

    const registered = await checkDomains('Harbour & Co', { lookup: async () => 'registered', sleep: noSleep, gapMs: 0, cache: null, now });
    expect(registered[1].label).toBe('Likely registered');
    expect(registered[1].status).not.toBe('available');

    const timedOut = await checkDomains('Harbour & Co', {
      lookup: async () => { throw new CheckTimeout(); },
      sleep: noSleep,
      gapMs: 0,
      cache: null,
      now,
    });
    expect(timedOut.every((row) => row.status === 'error')).toBe(true);
    expect(timedOut.every((row) => row.status !== 'available')).toBe(true);

    let lookups = 0;
    const unusable = await checkDomains('!!!', {
      lookup: async () => { lookups += 1; return 'absent'; },
      sleep: noSleep,
      gapMs: 0,
      cache: null,
      now,
    });
    expect(lookups).toBe(0);
    expect(unusable.every((row) => row.status === 'risk')).toBe(true);
  });

  it('uses DNS-over-HTTPS and stops when the lookup times out', async () => {
    const seen = [];
    const rows = await checkDomains('Harbour', {
      fetchImpl: async (url) => {
        seen.push(String(url));
        return new Response(JSON.stringify({ Status: 0, Answer: [{ name: 'harbour.com.au.', type: 2, data: 'ns.example.' }] }), { status: 200 });
      },
      sleep: noSleep,
      gapMs: 0,
      timeoutMs: 1000,
      cache: null,
      now,
    });
    const first = requestUrl(seen[0]);
    expect(first.hostname).toBe('cloudflare-dns.com');
    expect(first.pathname).toBe('/dns-query');
    expect(first.searchParams.get('type')).toBe('NS');
    expect(rows[0].label).toBe('Likely registered');
    expect(rows[0].status).not.toBe('available');

    const timed = await checkDomains('Harbour', {
      fetchImpl: hang,
      sleep: noSleep,
      gapMs: 0,
      timeoutMs: 15,
      cache: null,
      now,
    });
    expect(timed[0].status).toBe('error');
    expect(timed[0].detail.toLowerCase()).toContain('not a clearance');
  });
});

describe('ABN Lookup', () => {
  it('stays amber and does not call the service when ABR_GUID is missing', async () => {
    let called = false;
    const row = await checkAbn('Harbour & Co', {
      guid: '',
      fetchImpl: async () => { called = true; throw new Error('no'); },
      sleep: noSleep,
      now,
    });
    expect(called).toBe(false);
    expect(row.status).toBe('risk');
    expect(row.detail.toLowerCase()).toContain('not yet available');
    expect(row.href).toBe('https://abr.business.gov.au/');
  });

  it('reads exact names from result records and ignores the request echo', () => {
    const xml = `
      <request><name>Harbour &amp; Co</name></request>
      <searchResultsRecord><organisationName>OTHER NAME</organisationName></searchResultsRecord>
      <searchResultsRecord><organisationName>HARBOUR AND CO</organisationName></searchResultsRecord>`;
    expect(exactNamesFromAbrXml(xml)).toEqual(['OTHER NAME', 'HARBOUR AND CO']);
  });

  it('marks an exact active match as taken and a miss as amber, never green', async () => {
    const fetchImpl = async () => new Response(`
      <ABRPayloadSearchResults>
        <request><authenticationGuid>${GUID}</authenticationGuid><name>Harbour</name></request>
        <searchResultsRecord><organisationName>HARBOUR AND CO</organisationName></searchResultsRecord>
      </ABRPayloadSearchResults>`);
    const exact = await checkAbn('Harbour & Co', { guid: GUID, fetchImpl, sleep: noSleep, gapMs: 0, timeoutMs: 1000, cache: null, now });
    expect(exact.status).toBe('taken');
    expect(exact.detail).not.toContain(GUID);

    const none = await checkAbn('Harbour & Co', {
      guid: GUID,
      fetchImpl: async () => new Response('<ABRPayloadSearchResults><response></response></ABRPayloadSearchResults>'),
      sleep: noSleep,
      gapMs: 0,
      timeoutMs: 1000,
      cache: null,
      now,
    });
    expect(none.status).toBe('risk');
    expect(none.status).not.toBe('available');
    expect(none.detail.toLowerCase()).toContain('no exact name match');
  });

  it('hides the GUID when the service rejects it, and times out as an error', async () => {
    const rejected = await checkAbn('Harbour', {
      guid: GUID,
      fetchImpl: async () => new Response(`<exception><exceptionDescription>The GUID entered is not recognised ${GUID}</exceptionDescription></exception>`),
      sleep: noSleep,
      gapMs: 0,
      timeoutMs: 1000,
      cache: null,
      now,
    });
    expect(rejected.status).toBe('error');
    expect(rejected.detail).not.toContain(GUID);
    expect(rejected.detail).toContain('[redacted]');

    const timed = await checkAbn('Harbour', { guid: GUID, fetchImpl: hang, sleep: noSleep, gapMs: 0, timeoutMs: 15, cache: null, now });
    expect(timed.status).toBe('error');
    expect(timed.detail.toLowerCase()).toContain('did not answer in time');
    expect(timed.status).not.toBe('available');
  });
});

describe('trade marks', () => {
  it('links out and does not call the API when the test secrets are missing', async () => {
    let called = false;
    const row = await checkTradeMark('Harbour & Co', {
      clientId: '',
      clientSecret: '',
      envName: 'test',
      fetchImpl: async () => { called = true; throw new Error('no'); },
      now,
    });
    expect(called).toBe(false);
    expect(row.status).toBe('risk');
    const link = requestUrl(row.href);
    expect(link.hostname).toBe('search.ipaustralia.gov.au');
    expect(link.pathname).toBe('/trademarks/search/quick/result');
    expect(link.searchParams.get('q')).toContain('Harbour');
    expect(row.status).not.toBe('available');

    const ignored = await checkTradeMark('Harbour', {
      clientId: 'client-id-value',
      clientSecret: 'client-secret-value',
      envName: 'production',
      fetchImpl: async () => { called = true; throw new Error('no'); },
      now,
    });
    expect(called).toBe(false);
    expect(ignored.detail).toContain('IPA_ENV is test');
  });

  it('counts test-API matches without turning an empty search green, and times out', async () => {
    expect(tradeMarkMatchCount({ results: [{}, {}] })).toBe(2);
    expect(tradeMarkMatchCount({ total: 0 })).toBe(0);
    const empty = await checkTradeMark('Harbour', {
      clientId: 'client-id-value',
      clientSecret: 'client-secret-value',
      envName: 'test',
      sleep: noSleep,
      gapMs: 0,
      timeoutMs: 1000,
      cache: null,
      now,
      fetchImpl: async (url) => {
        const target = requestUrl(url);
        expect(target.hostname).toBe('test.api.ipaustralia.gov.au');
        if (target.pathname === '/public/external-token-api/v1/access_token') {
          return new Response(JSON.stringify({ access_token: 'token-value-ok', token_type: 'Bearer' }));
        }
        return new Response(JSON.stringify({ results: [] }));
      },
    });
    expect(empty.status).toBe('risk');
    expect(empty.detail.toLowerCase()).toContain('no word matches');
    expect(empty.status).not.toBe('available');

    const timed = await checkTradeMark('Harbour', {
      clientId: 'client-id-value',
      clientSecret: 'client-secret-value',
      envName: 'test',
      sleep: noSleep,
      gapMs: 0,
      timeoutMs: 15,
      cache: null,
      now,
      fetchImpl: hang,
    });
    expect(timed.status).toBe('error');
    expect(requestUrl(timed.href).hostname).toBe('search.ipaustralia.gov.au');
    expect(timed.status).not.toBe('available');
  });
});

describe('ASIC business names', () => {
  it('is an amber official link unless a real non-available signal exists', async () => {
    const row = await checkBusinessName('Harbour & Co', { now, cache: null });
    expect(row.status).toBe('risk');
    expect(row.href).toBe('https://www.asic.gov.au/online-services/search-asic-registers/business-names-register');
    expect(row.detail).toContain('Harbour & Co');

    const ignored = await checkBusinessName('Harbour', {
      now,
      cache: null,
      signal: async () => ({ status: 'available', detail: 'Free to register.' }),
    });
    expect(ignored.status).toBe('risk');
    expect(ignored.detail).not.toContain('Free to register');

    const failed = await checkBusinessName('Harbour', {
      now,
      cache: null,
      signal: async () => { throw new Error('down'); },
    });
    expect(failed.status).toBe('error');
    expect(failed.status).not.toBe('available');
  });
});

describe('paid name-check endpoint', () => {
  it('rejects a locked caller before any lookup', async () => {
    let called = false;
    const response = await onRequestPost({
      request: new Request('https://example.test/api/name-check', {
        method: 'POST',
        headers: { origin: 'https://example.test', 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Harbour' }),
      }),
      env: { DATA: createMemoryKv(), COOKIE_SECRET: 'cookie-secret-at-least-32-characters', fetchImpl: async () => { called = true; throw new Error('no'); } },
    });
    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  it('returns cautious rows for a paid caller and never leaks the GUID', async () => {
    const kv = createMemoryKv();
    const id = crypto.randomUUID();
    await kv.put(keys.entitlement(id), JSON.stringify({ status: 'paid' }));
    const secret = 'cookie-secret-at-least-32-characters';
    const token = await signEntitlementToken(secret, id, Math.floor(Date.now() / 1000) + 3600);
    const cookie = entitlementSetCookie(token, { secure: true });
    const response = await onRequestPost({
      request: new Request('https://example.test/api/name-check', {
        method: 'POST',
        headers: { origin: 'https://example.test', 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'Harbour & Co' }),
      }),
      env: {
        DATA: kv,
        COOKIE_SECRET: secret,
        ABR_GUID: GUID,
        gapMs: 0,
        timeoutMs: 1000,
        sleep: noSleep,
        fetchImpl: async (url) => {
          const target = requestUrl(url);
          expect(target.href).not.toContain(GUID);
          if (target.hostname === 'cloudflare-dns.com') {
            return new Response(JSON.stringify({ Status: 3 }), { status: 200 });
          }
          if (target.hostname === 'abr.business.gov.au') {
            return new Response(`<exception><exceptionDescription>Rejected ${GUID}</exceptionDescription></exception>`, { status: 200 });
          }
          throw new Error(`unexpected ${target.hostname}`);
        },
      },
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.results.every((row) => row.status !== 'available')).toBe(true);
    expect(body.summary.tone).not.toBe('green');
    expect(JSON.stringify(body)).not.toContain(GUID);
    expect(body.results.find((row) => row.source === 'abn').status).toBe('error');
    expect(body.results.find((row) => row.source === 'business-name').status).toBe('risk');
  });

  it('does not serve the check as a static asset', async () => {
    const response = await dispatch(new Request('https://example.test/api/name-check'), {}, () => new Response('asset'));
    expect(response.status).toBe(405);
  });
});

describe('register links', () => {
  it('drops anything that is not an official https register', () => {
    expect(safeRegisterHref('javascript:alert(1)')).toBeUndefined();
    expect(safeRegisterHref('https://evil.example/abr.business.gov.au')).toBeUndefined();
    expect(safeRegisterHref('https://abr.business.gov.au/')).toBe('https://abr.business.gov.au/');
  });
});
