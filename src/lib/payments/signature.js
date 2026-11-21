/**
 * Stripe webhook signature check.
 * Matches the scheme used by Stripe's libraries: HMAC-SHA256 over
 * `${timestamp}.${rawBody}`, hex digest, header `t=...,v1=...`.
 * The signing secret is the raw string, including a `whsec_` prefix when
 * Stripe issued one.
 */

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export function parseStripeSignatureHeader(header) {
  if (typeof header !== 'string' || header.length === 0 || header.length > 2000) {
    return { timestamp: null, signatures: [] };
  }
  let timestamp = null;
  const signatures = [];
  for (const part of header.split(',')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (key === 't' && /^\d{1,12}$/.test(value)) timestamp = value;
    if (key === 'v1' && /^[a-f0-9]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  return { timestamp, signatures };
}

export async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * @returns {Promise<{ ok: true, timestamp: number } | { ok: false, error: string }>}
 */
export async function verifyStripeSignature({
  rawBody,
  signatureHeader,
  secret,
  now = Date.now(),
  toleranceSec = 300,
}) {
  if (typeof secret !== 'string' || secret.length < 8) {
    return { ok: false, error: 'missing_secret' };
  }
  if (typeof rawBody !== 'string') {
    return { ok: false, error: 'missing_body' };
  }
  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    return { ok: false, error: 'invalid_header' };
  }
  const timestampSec = Number(timestamp);
  if (toleranceSec > 0 && timestampSec < Math.floor(now / 1000) - toleranceSec) {
    return { ok: false, error: 'timestamp_expired' };
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const match = signatures.some((signature) => safeEqual(signature, expected));
  if (!match) return { ok: false, error: 'signature_mismatch' };
  return { ok: true, timestamp: timestampSec };
}
