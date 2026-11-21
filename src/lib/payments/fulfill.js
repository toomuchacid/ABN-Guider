import { isPaymentIntentId, isSessionId, isUuid, keys } from '../ids.js';

export function entitlementIdFromSession(session) {
  const fromMeta = session?.metadata?.entitlementId;
  const fromRef = session?.client_reference_id;
  if (isUuid(fromMeta)) return fromMeta;
  if (isUuid(fromRef)) return fromRef;
  return null;
}

export function paymentIntentIdFrom(value) {
  if (isPaymentIntentId(value)) return value;
  if (value && isPaymentIntentId(value.id)) return value.id;
  return null;
}

export function sessionGrantsAccess(session) {
  return session?.payment_status === 'paid';
}

async function readEntitlement(kv, id) {
  return kv.get(keys.entitlement(id), 'json');
}

async function writeEntitlement(kv, record) {
  await kv.put(keys.entitlement(record.id), JSON.stringify(record));
}

/**
 * Grant access only when Stripe says the session is paid.
 * A refunded entitlement is never flipped back to paid by a replay.
 */
export async function fulfillPaidSession(kv, session, paidAt) {
  const id = entitlementIdFromSession(session);
  if (!id) return { fulfilled: false, reason: 'invalid_entitlement' };
  if (!sessionGrantsAccess(session)) return { fulfilled: false, reason: 'unpaid', entitlementId: id };

  const existing = await readEntitlement(kv, id);
  if (existing?.status === 'refunded') return { fulfilled: false, reason: 'refunded', entitlementId: id };
  if (existing?.status === 'paid') return { fulfilled: true, already: true, entitlementId: id };

  const paymentIntentId = paymentIntentIdFrom(session.payment_intent);
  const record = {
    id,
    status: 'paid',
    stripeSessionId: isSessionId(session.id) ? session.id : null,
    paymentIntentId,
    email: typeof session.customer_details?.email === 'string' ? session.customer_details.email : null,
    paidAt,
    createdAt: existing?.createdAt || paidAt,
  };
  await writeEntitlement(kv, record);
  if (isSessionId(session.id)) await kv.put(keys.session(session.id), id);
  if (paymentIntentId) await kv.put(keys.payment(paymentIntentId), id);
  return { fulfilled: true, entitlementId: id };
}

export async function markSessionUnpaid(kv, session, status, at) {
  const id = entitlementIdFromSession(session);
  if (!id) return { updated: false, reason: 'invalid_entitlement' };
  const existing = await readEntitlement(kv, id);
  if (existing?.status === 'paid' || existing?.status === 'refunded') {
    return { updated: false, reason: 'locked', entitlementId: id };
  }
  await writeEntitlement(kv, {
    id,
    status,
    stripeSessionId: isSessionId(session.id) ? session.id : existing?.stripeSessionId || null,
    createdAt: existing?.createdAt || at,
    updatedAt: at,
  });
  if (isSessionId(session.id)) await kv.put(keys.session(session.id), id);
  return { updated: true, entitlementId: id, status };
}

export async function revokeByPaymentIntent(kv, paymentIntent, at) {
  const paymentIntentId = paymentIntentIdFrom(paymentIntent);
  if (!paymentIntentId) return { revoked: false, reason: 'invalid_payment_intent' };
  const entitlementId = await kv.get(keys.payment(paymentIntentId));
  if (!isUuid(entitlementId)) return { revoked: false, reason: 'unknown_payment' };
  const existing = await readEntitlement(kv, entitlementId);
  if (!existing) return { revoked: false, reason: 'missing_entitlement' };
  if (existing.status === 'refunded') return { revoked: true, already: true, entitlementId };
  await writeEntitlement(kv, { ...existing, status: 'refunded', refundedAt: at });
  return { revoked: true, entitlementId };
}
