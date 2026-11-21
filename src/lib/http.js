export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function isSameOrigin(request) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const fetchSite = request.headers.get('sec-fetch-site');
  return fetchSite === 'same-origin' || fetchSite === 'none';
}

export function wantsJson(request) {
  const type = request.headers.get('content-type') || '';
  return type.includes('application/json');
}

export async function readBodyText(request, maxLength) {
  const raw = await request.text();
  if (raw.length > maxLength) {
    return { ok: false, error: 'too_large' };
  }
  return { ok: true, raw };
}
