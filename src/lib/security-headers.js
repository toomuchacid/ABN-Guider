import { brand } from '../config/brand.js';

const PLAUSIBLE_ORIGIN = 'https://plausible.io';
const CF_SCRIPT = 'https://static.cloudflareinsights.com';
const CF_CONNECT = 'https://cloudflareinsights.com';

export function analyticsSources() {
  const provider = brand.analytics?.provider || 'none';
  const script = ["'self'"];
  const connect = ["'self'"];
  if (provider === 'none') return { provider, script, connect };
  if (provider === 'plausible') {
    if (!/^[a-z0-9.-]+$/i.test(brand.analytics.plausibleDomain || '')) {
      throw new Error('Plausible domain is missing or unsafe. Fix brand.analytics.plausibleDomain.');
    }
    script.push(PLAUSIBLE_ORIGIN);
    connect.push(PLAUSIBLE_ORIGIN);
    return { provider, script, connect };
  }
  if (provider === 'cloudflare') {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(brand.analytics.cloudflareToken || '')) {
      throw new Error('Cloudflare Web Analytics token is missing or unsafe.');
    }
    script.push(CF_SCRIPT);
    connect.push(CF_CONNECT);
    return { provider, script, connect };
  }
  throw new Error(`Unknown analytics provider: ${provider}`);
}

export function contentSecurityPolicy() {
  const { script, connect } = analyticsSources();
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function securityHeaderEntries() {
  return [
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['X-Frame-Options', 'DENY'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Content-Security-Policy', contentSecurityPolicy()],
  ];
}

export function headersFile() {
  const base = securityHeaderEntries().map(([key, value]) => `  ${key}: ${value}`);
  const block = (path, extra = []) => [`${path}`, ...base, ...extra.map((line) => `  ${line}`), ''].join('\n');
  return [
    block('/*'),
    block('/assets/*', ['Cache-Control: public, max-age=3600']),
    block('/report', ['Cache-Control: no-store', 'X-Robots-Tag: noindex']),
    block('/report.html', ['Cache-Control: no-store', 'X-Robots-Tag: noindex']),
    block('/unlock/return', ['Cache-Control: no-store', 'X-Robots-Tag: noindex']),
    block('/api/*', ['Cache-Control: no-store', 'X-Robots-Tag: noindex']),
  ].join('\n');
}

export function analyticsSnippet() {
  const { provider } = analyticsSources();
  if (provider === 'plausible') {
    const domain = brand.analytics.plausibleDomain;
    return `<script defer data-domain="${domain}" src="https://plausible.io/js/script.js"></script>`;
  }
  if (provider === 'cloudflare') {
    const token = brand.analytics.cloudflareToken;
    return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${token}"}'></script>`;
  }
  return '';
}
