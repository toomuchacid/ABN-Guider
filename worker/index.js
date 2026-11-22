import { onRequestPost as checkout } from '../functions/api/checkout.js';
import { onRequestGet as simulatePayment } from '../functions/api/dev/simulate-payment.js';
import { onRequestPost as feedback } from '../functions/api/feedback.js';
import { onRequestPost as stripeWebhook } from '../functions/api/stripe/webhook.js';
import { onRequest as gateReport } from '../functions/_middleware.js';
import { onRequestGet as unlockReturn } from '../functions/unlock/return.js';

function methodNotAllowed() {
  return new Response('Method not allowed', { status: 405, headers: { 'cache-control': 'no-store' } });
}

/**
 * Workers Builds deploys this module with `wrangler deploy`.
 * `wrangler pages dev` still uses the files in /functions directly.
 * Both call the same handlers.
 */
export async function dispatch(request, env, fetchAsset) {
  const url = new URL(request.url);
  const path = url.pathname;
  const context = {
    request,
    env,
    waitUntil() {},
    data: {},
    next: () => fetchAsset(request),
  };

  if (path === '/api/checkout') {
    return request.method === 'POST' ? checkout(context) : methodNotAllowed();
  }
  if (path === '/api/stripe/webhook') {
    return request.method === 'POST' ? stripeWebhook(context) : methodNotAllowed();
  }
  if (path === '/api/feedback') {
    return request.method === 'POST' ? feedback(context) : methodNotAllowed();
  }
  if (path === '/api/dev/simulate-payment') {
    return request.method === 'GET' ? simulatePayment(context) : methodNotAllowed();
  }
  if (path === '/unlock/return') {
    return request.method === 'GET' ? unlockReturn(context) : methodNotAllowed();
  }
  if (path === '/report' || path === '/report/' || path === '/report.html') {
    return gateReport(context);
  }
  return fetchAsset(request);
}

export default {
  async fetch(request, env) {
    return dispatch(request, env, (assetRequest) => env.ASSETS.fetch(assetRequest));
  },
};
