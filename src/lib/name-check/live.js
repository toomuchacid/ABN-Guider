import { checkAbn } from './abn.js';
import { checkBusinessName } from './asic.js';
import { checkDomains } from './dns.js';
import { defaultSleep, kvResultCache } from './support.js';
import { checkTradeMark } from './trade-mark.js';

/**
 * Server-side adapters. `lookup` replaces the DNS check when Synergy
 * Wholesale is connected. Secrets are read from the Worker env only.
 */
export function createLiveAdapters(env = {}, options = {}) {
  const deps = {
    fetchImpl: options.fetchImpl || globalThis.fetch.bind(globalThis),
    timeoutMs: options.timeoutMs ?? 4000,
    sleep: options.sleep || defaultSleep,
    gapMs: options.gapMs ?? 200,
    now: options.now || (() => new Date()),
    cache: options.cache === undefined ? kvResultCache(env.DATA) : options.cache,
    lookup: options.lookup,
    signal: options.signal,
    guid: env.ABR_GUID,
    clientId: env.IPA_CLIENT_ID,
    clientSecret: env.IPA_CLIENT_SECRET,
    envName: env.IPA_ENV,
  };
  return [
    {
      source: 'domain',
      check(name) {
        return checkDomains(name, deps);
      },
    },
    {
      source: 'abn',
      check(name) {
        return checkAbn(name, deps);
      },
    },
    {
      source: 'trade-mark',
      check(name) {
        return checkTradeMark(name, deps);
      },
    },
    {
      source: 'business-name',
      check(name) {
        return checkBusinessName(name, deps);
      },
    },
  ];
}
