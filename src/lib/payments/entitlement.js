import { brand } from '../../config/brand.js';
import { isUuid, keys } from '../ids.js';

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return bytesToBase64Url(new Uint8Array(buf));
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export async function signEntitlementToken(secret, id, expSeconds) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ v: 1, id, exp: expSeconds })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function readEntitlementToken(secret, token, nowMs) {
  if (typeof secret !== 'string' || secret.length < 16) return null;
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const dot = token.indexOf('.');
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig || token.indexOf('.', dot + 1) !== -1) return null;
  const expected = await hmac(secret, payload);
  if (!safeEqual(sig, expected)) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (json?.v !== 1 || !isUuid(json.id) || typeof json.exp !== 'number') return null;
    if (json.exp * 1000 <= nowMs) return null;
    return { id: json.id, exp: json.exp };
  } catch {
    return null;
  }
}

export function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === name) {
      try {
        return decodeURIComponent(trimmed.slice(eq + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function requestIsSecure(request) {
  const url = new URL(request.url);
  if (url.protocol === 'https:') return true;
  return request.headers.get('x-forwarded-proto') === 'https';
}

export function entitlementSetCookie(token, { secure, maxAge = brand.cookieMaxAgeSeconds, name = brand.cookieName } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export async function requestHasPaidEntitlement({ request, env, now = Date.now() }) {
  if (!env?.DATA || typeof env.COOKIE_SECRET !== 'string') return false;
  const token = readCookie(request, brand.cookieName);
  const parsed = await readEntitlementToken(env.COOKIE_SECRET, token, now);
  if (!parsed) return false;
  const record = await env.DATA.get(keys.entitlement(parsed.id), 'json');
  return record?.status === 'paid';
}

export async function issueEntitlementCookie({ request, env, entitlementId, now = Date.now() }) {
  const exp = Math.floor(now / 1000) + brand.cookieMaxAgeSeconds;
  const token = await signEntitlementToken(env.COOKIE_SECRET, entitlementId, exp);
  return entitlementSetCookie(token, { secure: requestIsSecure(request) });
}
