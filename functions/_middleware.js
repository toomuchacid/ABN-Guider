import { requestHasPaidEntitlement } from '../src/lib/payments/entitlement.js';

const GATED = /^\/report(?:\.html)?\/?$/;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!GATED.test(url.pathname)) return context.next();

  let allowed = false;
  try {
    allowed = await requestHasPaidEntitlement({ request: context.request, env: context.env });
  } catch (error) {
    console.error('entitlement_check_failed', error instanceof Error ? error.name : 'error');
    allowed = false;
  }

  if (!allowed) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/unlock',
        'Cache-Control': 'no-store',
      },
    });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
