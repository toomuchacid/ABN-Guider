import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { createMemoryKv } from '../src/lib/kv/memory.js';
import { keys } from '../src/lib/ids.js';
import { buildCheckoutFields, checkoutFieldsInclude, makeIntegrationId } from '../src/lib/payments/checkout-form.js';
import {
  entitlementSetCookie,
  readEntitlementToken,
  requestHasPaidEntitlement,
  signEntitlementToken,
} from '../src/lib/payments/entitlement.js';
import { simulationAllowed } from '../src/lib/payments/simulation.js';
import { STRIPE_API_VERSION } from '../src/lib/payments/stripe.js';
import { verifyStripeSignature } from '../src/lib/payments/signature.js';
import { processStripeWebhook } from '../src/lib/payments/webhook.js';

const stripe = new Stripe('unit-test-key', { apiVersion: STRIPE_API_VERSION });
const SECRET = 'whsec_unit_test_signing_secret_value';
const COOKIE_SECRET = 'cookie-secret-for-unit-tests-32';

function paidEvent(id, entitlementId, sessionId, paymentIntentId) {
  return {
    id,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        client_reference_id: entitlementId,
        metadata: { entitlementId },
        payment_intent: paymentIntentId,
        customer_details: { email: 'person@example.com' },
      },
    },
  };
}

async function signed(payload, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });
  return { header, timestamp };
}

describe('Stripe webhook signatures', () => {
  it('accepts a header produced by Stripe and rejects tampering', async () => {
    const payload = JSON.stringify({ id: 'evt_testsignature', object: 'event', type: 'checkout.session.completed' });
    const { header, timestamp } = await signed(payload);
    const now = timestamp * 1000;

    await expect(verifyStripeSignature({
      rawBody: payload,
      signatureHeader: header,
      secret: SECRET,
      now,
    })).resolves.toMatchObject({ ok: true });

    expect(stripe.webhooks.constructEvent(payload, header, SECRET, 300, undefined, now)).toBeTruthy();

    const tampered = await verifyStripeSignature({
      rawBody: `${payload} `,
      signatureHeader: header,
      secret: SECRET,
      now,
    });
    expect(tampered.ok).toBe(false);
    expect(() => stripe.webhooks.constructEvent(`${payload} `, header, SECRET, 300, undefined, now)).toThrow();

    const wrongSecret = await verifyStripeSignature({
      rawBody: payload,
      signatureHeader: header,
      secret: 'whsec_different_secret_value',
      now,
    });
    expect(wrongSecret.ok).toBe(false);

    const stale = await verifyStripeSignature({
      rawBody: payload,
      signatureHeader: header,
      secret: SECRET,
      now: now + 301_000,
    });
    expect(stale).toMatchObject({ ok: false, error: 'timestamp_expired' });

    const missing = await verifyStripeSignature({
      rawBody: payload,
      signatureHeader: '',
      secret: SECRET,
      now,
    });
    expect(missing.ok).toBe(false);
  });

  it('accepts any matching v1 signature so secrets can rotate', async () => {
    const payload = JSON.stringify({ id: 'evt_rotation', type: 'ping' });
    const { header, timestamp } = await signed(payload);
    const decoy = `${'ab'.repeat(32)}`;
    const rotated = header.replace('v1=', `v1=${decoy},v1=`);
    const result = await verifyStripeSignature({
      rawBody: payload,
      signatureHeader: rotated,
      secret: SECRET,
      now: timestamp * 1000,
    });
    expect(result.ok).toBe(true);
  });
});

describe('entitlement fulfillment', () => {
  it('grants access only for a paid, signed event and revokes it on refund', async () => {
    const kv = createMemoryKv();
    const entitlementId = crypto.randomUUID();
    const sessionId = 'cs_test_paidflow123';
    const paymentIntentId = 'pi_paidflow12345';
    const payload = JSON.stringify(paidEvent('evt_paidflow1', entitlementId, sessionId, paymentIntentId));
    const { header } = await signed(payload);

    const unpaid = JSON.stringify(paidEvent('evt_unpaidflow1', crypto.randomUUID(), 'cs_test_unpaidflow1', 'pi_unpaidflow123'));
    const unpaidBody = unpaid.replace('"payment_status":"paid"', '"payment_status":"unpaid"');
    const unpaidHeader = (await signed(unpaidBody)).header;
    const unpaidResult = await processStripeWebhook({ rawBody: unpaidBody, signatureHeader: unpaidHeader, secret: SECRET, kv });
    expect(unpaidResult.status).toBe(200);
    expect(unpaidResult.body.result.fulfilled).toBe(false);

    const bad = await processStripeWebhook({ rawBody: payload, signatureHeader: 't=1,v1=abcd', secret: SECRET, kv });
    expect(bad.status).toBe(400);
    expect(await kv.get(keys.entitlement(entitlementId))).toBeNull();

    const ok = await processStripeWebhook({ rawBody: payload, signatureHeader: header, secret: SECRET, kv });
    expect(ok.status).toBe(200);
    expect(ok.body.result.fulfilled).toBe(true);
    const duplicate = await processStripeWebhook({ rawBody: payload, signatureHeader: header, secret: SECRET, kv });
    expect(duplicate.body.duplicate).toBe(true);

    const record = await kv.get(keys.entitlement(entitlementId), 'json');
    expect(record).toMatchObject({ status: 'paid', email: 'person@example.com' });

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await signEntitlementToken(COOKIE_SECRET, entitlementId, exp);
    const cookie = entitlementSetCookie(token, { secure: false });
    const env = { DATA: kv, COOKIE_SECRET };
    const allowed = await requestHasPaidEntitlement({
      request: new Request('http://127.0.0.1/report', { headers: { cookie } }),
      env,
    });
    expect(allowed).toBe(true);

    const rawToken = decodeURIComponent(cookie.split(';')[0].split('=').slice(1).join('='));
    expect((await readEntitlementToken(COOKIE_SECRET, rawToken, Date.now()))?.id).toBe(entitlementId);
    const flipped = `${rawToken.slice(0, -1)}${rawToken.endsWith('a') ? 'b' : 'a'}`;
    expect(await readEntitlementToken(COOKIE_SECRET, flipped, Date.now())).toBeNull();

    const expired = await signEntitlementToken(COOKIE_SECRET, entitlementId, Math.floor(Date.now() / 1000) - 10);
    expect(await readEntitlementToken(COOKIE_SECRET, expired, Date.now())).toBeNull();

    const refundPayload = JSON.stringify({
      id: 'evt_refundflow1',
      type: 'charge.refunded',
      data: { object: { object: 'charge', payment_intent: paymentIntentId, refunded: true } },
    });
    const refundHeader = (await signed(refundPayload)).header;
    const refunded = await processStripeWebhook({ rawBody: refundPayload, signatureHeader: refundHeader, secret: SECRET, kv });
    expect(refunded.body.result.revoked).toBe(true);

    const afterRefund = await requestHasPaidEntitlement({
      request: new Request('http://127.0.0.1/report', { headers: { cookie } }),
      env,
    });
    expect(afterRefund).toBe(false);

    const replay = await processStripeWebhook({
      rawBody: JSON.stringify(paidEvent('evt_paidreplay1', entitlementId, sessionId, paymentIntentId)),
      signatureHeader: (await signed(JSON.stringify(paidEvent('evt_paidreplay1', entitlementId, sessionId, paymentIntentId)))).header,
      secret: SECRET,
      kv,
    });
    expect(replay.body.result.reason).toBe('refunded');
    expect((await kv.get(keys.entitlement(entitlementId), 'json')).status).toBe('refunded');
  });

  it('does not fulfill async success while the session is unpaid', async () => {
    const kv = createMemoryKv();
    const entitlementId = crypto.randomUUID();
    const payload = JSON.stringify({
      id: 'evt_asyncwait1',
      type: 'checkout.session.async_payment_succeeded',
      data: {
        object: {
          id: 'cs_test_asyncwait1',
          payment_status: 'unpaid',
          metadata: { entitlementId },
        },
      },
    });
    const result = await processStripeWebhook({
      rawBody: payload,
      signatureHeader: (await signed(payload)).header,
      secret: SECRET,
      kv,
    });
    expect(result.body.result).toMatchObject({ fulfilled: false, reason: 'unpaid' });
    expect(await kv.get(keys.entitlement(entitlementId))).toBeNull();
  });
});

describe('checkout request shape', () => {
  it('prices from config, omits payment method types, and tags the integration', () => {
    const fields = buildCheckoutFields({
      origin: 'https://example.com',
      entitlementId: crypto.randomUUID(),
      integrationId: makeIntegrationId('abcdefgh'),
    });
    const keysInBody = fields.map(([key]) => key);
    expect(keysInBody).not.toContain('payment_method_types');
    expect(keysInBody.join(' ')).not.toContain('automatic_tax');
    expect(fields.find(([key]) => key === 'line_items[0][price_data][unit_amount]')[1]).toBe('1900');
    expect(fields.find(([key]) => key === 'line_items[0][price_data][currency]')[1]).toBe('aud');
    expect(fields.find(([key]) => key === 'success_url')[1]).toContain('{CHECKOUT_SESSION_ID}');
    expect(fields.find(([key]) => key === 'integration_identifier')[1]).toBe('startup-savvy-unlock-abcdefgh');
    expect(checkoutFieldsInclude(fields, 'metadata[entitlementId]')).toBe(true);
    expect(() => makeIntegrationId('abcdefg')).toThrow(/8 letters/);
  });

  it('allows payment simulation only on localhost when the flag is exactly true', () => {
    const env = { ENABLE_PAYMENT_SIMULATION: 'true' };
    expect(simulationAllowed({ url: 'http://127.0.0.1:8788/api/checkout' }, env)).toBe(true);
    expect(simulationAllowed({ url: 'http://localhost:8788/api/checkout' }, env)).toBe(true);
    expect(simulationAllowed({ url: 'https://startup-savvy.pages.dev/api/checkout' }, env)).toBe(false);
    expect(simulationAllowed({ url: 'http://127.0.0.1:8788/api/checkout' }, { ENABLE_PAYMENT_SIMULATION: 'false' })).toBe(false);
  });
});
