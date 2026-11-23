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

/** Hosted Checkout only. Card entry stays on Stripe; this site never frames it. */
export const STRIPE_CHECKOUT_ORIGIN = 'https://checkout.stripe.com';

export function contentSecurityPolicy({ allowStripeCheckout = false } = {}) {
  const { script, connect } = analyticsSources();
  // form-action is checked against the URL after redirects. A 303 from
  // /api/checkout to Checkout is blocked when this stays 'self'.
  // The return and cancel URLs are same-origin navigations, not form posts,
  // so they do not need connect-src, frame-src, or a Stripe form-action.
  const formAction = allowStripeCheckout
    ? `form-action 'self' ${STRIPE_CHECKOUT_ORIGIN}`
    : "form-action 'self'";
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    formAction,
    "object-src 'none'",
  ].join('; ');
}

export function securityHeaderEntries(options) {
  return [
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['X-Frame-Options', 'DENY'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Content-Security-Policy', contentSecurityPolicy(options)],
  ];
}

/**
 * Cloudflare sends every matching `_headers` policy, and a browser enforces
 * all of them. The catch-all must not set a Content-Security-Policy, or its
 * `form-action 'self'` stays in force on /unlock beside the Checkout exception.
 */
export function headersFile() {
  const block = (path, entries) => [path, ...entries.map(([key, value]) => `  ${key}: ${value}`), ''].join('\n');
  const base = securityHeaderEntries().filter(([name]) => name !== 'Content-Security-Policy');
  const policy = (allowStripeCheckout) => [['Content-Security-Policy', contentSecurityPolicy({ allowStripeCheckout })]];
  const strict = policy(false);
  const checkout = policy(true);
  const hidden = [['Cache-Control', 'no-store'], ['X-Robots-Tag', 'noindex']];
  const documents = [
    '/',
    '/index.html',
    '/name-check',
    '/name-check.html',
    '/guide',
    '/guide.html',
    '/terms',
    '/terms.html',
    '/privacy',
    '/privacy.html',
    '/disclaimer',
    '/disclaimer.html',
    '/refunds',
    '/refunds.html',
    '/feedback',
    '/feedback.html',
    '/feedback/thanks',
    '/feedback/thanks.html',
    '/feedback/rejected',
    '/feedback/rejected.html',
    '/404.html',
  ];
  return [
    block('/*', base),
    block('/assets/*', [['Cache-Control', 'public, max-age=3600']]),
    block('/api/*', hidden),
    ...documents.map((path) => block(path, strict)),
    block('/report', [...strict, ...hidden]),
    block('/report/', [...strict, ...hidden]),
    block('/report.html', [...strict, ...hidden]),
    block('/unlock/return', [...strict, ...hidden]),
    block('/unlock/return/', [...strict, ...hidden]),
    block('/unlock', checkout),
    block('/unlock/', checkout),
    block('/unlock.html', checkout),
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
