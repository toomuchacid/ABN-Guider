export class CheckTimeout extends Error {
  constructor() {
    super('timeout');
    this.name = 'CheckTimeout';
  }
}

export function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function comparableName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** A domain label Synergy could later check. Spaces and punctuation become hyphens. */
export function domainLabel(name) {
  const label = String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (label.length < 2 || label.length > 63) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return null;
  return label;
}

export function secretMissing(value) {
  return typeof value !== 'string' || value.trim().length < 8 || value.trim().toLowerCase().startsWith('replace_me');
}

export function redactSecrets(text, secrets) {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out;
}

export function scrubValue(value, secrets) {
  if (typeof value === 'string') return redactSecrets(value, secrets);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, secrets));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = scrubValue(item, secrets);
    return out;
  }
  return value;
}

export async function fetchWithTimeout(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'CheckTimeout') throw new CheckTimeout();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function cacheKey(source, name) {
  const data = new TextEncoder().encode(`${source}\n${comparableName(name)}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `namecheck:v1:${source}:${hex}`;
}

export function kvResultCache(kv) {
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') return null;
  return {
    async get(key) {
      try {
        return await kv.get(key, 'json');
      } catch {
        return null;
      }
    },
    async set(key, value, ttlSeconds) {
      try {
        await kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
      } catch {
        /* a missed cache is safe */
      }
    },
  };
}

export async function withCache(cache, source, name, produce) {
  const key = await cacheKey(source, name);
  if (cache) {
    const hit = await cache.get(key);
    if (
      hit
      && hit.source === source
      && typeof hit.status === 'string'
      && hit.status !== 'available'
      && typeof hit.detail === 'string'
    ) {
      return hit;
    }
  }
  const result = await produce();
  if (cache && result?.status && result.status !== 'available') {
    await cache.set(key, result, result.status === 'error' ? 60 : 600);
  }
  return result;
}
