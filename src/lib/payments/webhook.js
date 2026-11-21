import { isEventId, keys } from '../ids.js';
import { verifyStripeSignature } from './signature.js';
import { fulfillPaidSession, markSessionUnpaid, revokeByPaymentIntent } from './fulfill.js';

export async function applyStripeEvent(kv, event, nowIso) {
  const object = event?.data?.object;
  switch (event?.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      return fulfillPaidSession(kv, object, nowIso);
    case 'checkout.session.async_payment_failed':
      return markSessionUnpaid(kv, object, 'failed', nowIso);
    case 'checkout.session.expired':
      return markSessionUnpaid(kv, object, 'expired', nowIso);
    case 'charge.refunded':
      return revokeByPaymentIntent(kv, object?.payment_intent, nowIso);
    default:
      return { ignored: true };
  }
}

/**
 * Verify the signature, apply the event, then record the event id.
 * Recording happens after a successful apply so Stripe can retry a failure.
 * Applying a paid session is idempotent, and a refund is never undone.
 */
export async function processStripeWebhook({
  rawBody,
  signatureHeader,
  secret,
  kv,
  now = Date.now(),
  toleranceSec = 300,
}) {
  const verified = await verifyStripeSignature({
    rawBody,
    signatureHeader,
    secret,
    now,
    toleranceSec,
  });
  if (!verified.ok) {
    return { status: 400, body: { error: verified.error } };
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid_json' } };
  }
  if (!isEventId(event?.id) || typeof event?.type !== 'string') {
    return { status: 400, body: { error: 'invalid_event' } };
  }

  const seenKey = keys.event(event.id);
  const seen = await kv.get(seenKey);
  if (seen) return { status: 200, body: { received: true, duplicate: true } };

  const result = await applyStripeEvent(kv, event, new Date(now).toISOString());
  await kv.put(seenKey, JSON.stringify({ type: event.type, at: new Date(now).toISOString() }));
  return { status: 200, body: { received: true, result } };
}
