import { json } from '../../../src/lib/http.js';
import { processStripeWebhook } from '../../../src/lib/payments/webhook.js';

export async function onRequestPost({ request, env }) {
  if (!env.DATA || typeof env.STRIPE_WEBHOOK_SECRET !== 'string' || env.STRIPE_WEBHOOK_SECRET.length < 8) {
    return json({ error: 'not_configured' }, 500);
  }
  const rawBody = await request.text();
  if (rawBody.length > 200_000) return json({ error: 'too_large' }, 413);
  try {
    const outcome = await processStripeWebhook({
      rawBody,
      signatureHeader: request.headers.get('stripe-signature'),
      secret: env.STRIPE_WEBHOOK_SECRET,
      kv: env.DATA,
    });
    return json(outcome.body, outcome.status);
  } catch (error) {
    console.error('webhook_failed', error instanceof Error ? error.name : 'error');
    return json({ error: 'webhook_failed' }, 500);
  }
}
