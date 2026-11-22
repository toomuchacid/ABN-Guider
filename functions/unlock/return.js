import { isSessionId, isUuid, keys } from '../../src/lib/ids.js';
import { entitlementIdFromSession } from '../../src/lib/payments/fulfill.js';
import { issueEntitlementCookie } from '../../src/lib/payments/entitlement.js';
import { simulationAllowed } from '../../src/lib/payments/simulation.js';
import { stripeHeaders } from '../../src/lib/payments/stripe.js';
import { renderConfigError, renderMissingSession, renderPendingPayment } from '../../src/pages/misc.js';

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

async function entitlementIdForSession(request, env, sessionId) {
  if (sessionId.startsWith('sim_')) {
    if (!simulationAllowed(request, env)) return { missing: true };
    return { id: await env.DATA.get(keys.session(sessionId)) };
  }

  const fromIndex = await env.DATA.get(keys.session(sessionId));
  if (typeof env.STRIPE_SECRET_KEY !== 'string' || env.STRIPE_SECRET_KEY.startsWith('replace_me')) {
    return { id: fromIndex };
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: stripeHeaders(env.STRIPE_SECRET_KEY).Authorization, 'Stripe-Version': stripeHeaders(env.STRIPE_SECRET_KEY)['Stripe-Version'] },
    });
    if (!response.ok) return { id: fromIndex };
    const session = await response.json();
    return { id: entitlementIdFromSession(session) || fromIndex };
  } catch (error) {
    console.error('stripe_session_lookup_failed', error instanceof Error ? error.name : 'error');
    return { id: fromIndex };
  }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  if (!isSessionId(sessionId)) return html(renderMissingSession(), 400);
  if (!env.DATA || typeof env.COOKIE_SECRET !== 'string' || env.COOKIE_SECRET.length < 16) {
    return html(renderConfigError(), 500);
  }

  const lookup = await entitlementIdForSession(request, env, sessionId);
  if (lookup.missing) return new Response('Not found', { status: 404 });

  if (isUuid(lookup.id)) {
    const record = await env.DATA.get(keys.entitlement(lookup.id), 'json');
    if (record?.status === 'paid') {
      const cookie = await issueEntitlementCookie({ request, env, entitlementId: lookup.id });
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/report',
          'Set-Cookie': cookie,
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  const attempt = Number.parseInt(url.searchParams.get('attempt') || '0', 10);
  const safeAttempt = Number.isFinite(attempt) && attempt >= 0 && attempt < 30 ? attempt : 0;
  return html(renderPendingPayment({ attempt: safeAttempt, sessionId }), 200);
}
