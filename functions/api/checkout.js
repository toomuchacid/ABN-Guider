import { isSameOrigin, json, wantsJson } from '../../src/lib/http.js';
import { isSessionId, keys } from '../../src/lib/ids.js';
import { buildCheckoutFields, encodeForm, makeIntegrationId } from '../../src/lib/payments/checkout-form.js';
import { simulationAllowed } from '../../src/lib/payments/simulation.js';
import { stripeHeaders } from '../../src/lib/payments/stripe.js';

function redirectOrJson(request, location, body, status) {
  if (wantsJson(request)) return json(body, status);
  return Response.redirect(new URL(location, request.url), 303);
}

async function readAcknowledged(request) {
  try {
    if (wantsJson(request)) {
      const body = await request.json();
      return { ok: true, acknowledged: body?.acknowledged === true };
    }
    const form = await request.formData();
    return { ok: true, acknowledged: form.get('acknowledged') === 'yes' };
  } catch {
    return { ok: false, acknowledged: false };
  }
}

function keyLooksMissing(value) {
  return typeof value !== 'string' || value.length < 12 || value.startsWith('replace_me');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isSameOrigin(request)) return json({ error: 'bad_origin' }, 403);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 20_000) return json({ error: 'too_large' }, 413);
  if (!env.DATA || typeof env.STRIPE_WEBHOOK_SECRET !== 'string' || env.STRIPE_WEBHOOK_SECRET.length < 8) {
    return redirectOrJson(request, '/unlock?error=config', { error: 'not_configured' }, 500);
  }

  const acknowledged = await readAcknowledged(request);
  if (!acknowledged.ok) return json({ error: 'invalid_body' }, 400);
  if (!acknowledged.acknowledged) {
    return redirectOrJson(request, '/unlock?error=acknowledge', { error: 'acknowledge_required' }, 400);
  }

  const entitlementId = crypto.randomUUID();
  const origin = new URL(request.url).origin;
  await env.DATA.put(keys.entitlement(entitlementId), JSON.stringify({
    id: entitlementId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }));

  if (simulationAllowed(request, env)) {
    const sessionId = `sim_${crypto.randomUUID().replaceAll('-', '')}`;
    await env.DATA.put(keys.session(sessionId), entitlementId);
    const url = `${origin}/api/dev/simulate-payment?session_id=${sessionId}`;
    return redirectOrJson(request, url, { url, entitlementId }, 200);
  }

  if (keyLooksMissing(env.STRIPE_SECRET_KEY)) {
    return redirectOrJson(request, '/unlock?error=config', { error: 'not_configured' }, 500);
  }

  const fields = buildCheckoutFields({
    origin,
    entitlementId,
    integrationId: makeIntegrationId(),
  });

  let data = {};
  let stripeStatus = 0;
  try {
    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        ...stripeHeaders(env.STRIPE_SECRET_KEY),
        'Idempotency-Key': `checkout_${entitlementId}`,
      },
      body: encodeForm(fields),
    });
    stripeStatus = stripeRes.status;
    data = await stripeRes.json().catch(() => ({}));
  } catch (error) {
    console.error('stripe_checkout_network', error instanceof Error ? error.name : 'error');
    return redirectOrJson(request, '/unlock?error=payment', { error: 'payment_unavailable' }, 502);
  }

  if (stripeStatus < 200 || stripeStatus >= 300 || typeof data.url !== 'string' || !data.url.startsWith('https://')) {
    console.error('stripe_checkout_error', stripeStatus, data?.error?.code || data?.error?.type || 'unknown');
    return redirectOrJson(request, '/unlock?error=payment', { error: 'payment_unavailable' }, 502);
  }

  if (isSessionId(data.id)) await env.DATA.put(keys.session(data.id), entitlementId);
  return redirectOrJson(request, data.url, { url: data.url, entitlementId }, 200);
}
