import { json } from '../../../src/lib/http.js';
import { isSessionId, isUuid, keys } from '../../../src/lib/ids.js';
import { hmacSha256Hex } from '../../../src/lib/payments/signature.js';
import { simulationAllowed } from '../../../src/lib/payments/simulation.js';
import { processStripeWebhook } from '../../../src/lib/payments/webhook.js';

export async function onRequestGet({ request, env }) {
  if (!simulationAllowed(request, env)) return new Response('Not found', { status: 404 });
  if (!env.DATA || typeof env.STRIPE_WEBHOOK_SECRET !== 'string') {
    return json({ error: 'not_configured' }, 500);
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  if (!isSessionId(sessionId) || !sessionId.startsWith('sim_')) return json({ error: 'bad_session' }, 400);

  const entitlementId = await env.DATA.get(keys.session(sessionId));
  if (!isUuid(entitlementId)) return json({ error: 'unknown_session' }, 404);

  const suffix = sessionId.slice(4);
  const event = {
    id: `evt_sim_${suffix}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        client_reference_id: entitlementId,
        metadata: { entitlementId },
        payment_intent: `pi_sim_${suffix}`,
      },
    },
  };
  const rawBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await hmacSha256Hex(env.STRIPE_WEBHOOK_SECRET, `${timestamp}.${rawBody}`);
  const outcome = await processStripeWebhook({
    rawBody,
    signatureHeader: `t=${timestamp},v1=${signature}`,
    secret: env.STRIPE_WEBHOOK_SECRET,
    kv: env.DATA,
  });
  if (outcome.status !== 200) return json(outcome.body, outcome.status);
  return Response.redirect(`${url.origin}/unlock/return?session_id=${encodeURIComponent(sessionId)}`, 303);
}
