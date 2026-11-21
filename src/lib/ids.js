const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_ID = /^(?:cs_[A-Za-z0-9_]{8,100}|sim_[A-Za-z0-9]{8,80})$/;
const PAYMENT_INTENT_ID = /^pi_[A-Za-z0-9_]{8,100}$/;
const EVENT_ID = /^evt_[A-Za-z0-9_]{4,100}$/;

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

export function isSessionId(value) {
  return typeof value === 'string' && value.length <= 120 && SESSION_ID.test(value);
}

export function isPaymentIntentId(value) {
  return typeof value === 'string' && value.length <= 120 && PAYMENT_INTENT_ID.test(value);
}

export function isEventId(value) {
  return typeof value === 'string' && value.length <= 120 && EVENT_ID.test(value);
}

export const keys = {
  entitlement: (id) => `entitlement:${id}`,
  session: (id) => `session:${id}`,
  payment: (id) => `payment:${id}`,
  event: (id) => `stripe_event:${id}`,
  feedback: (id) => `feedback:${id}`,
  feedbackRate: (bucket) => `feedback_rate:${bucket}`,
};
