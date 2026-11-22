import { isSameOrigin, json } from '../../src/lib/http.js';
import { keys } from '../../src/lib/ids.js';
import { containsTfnPhrase } from '../../src/lib/privacy/tfn.js';

function reject(request) {
  return Response.redirect(new URL('/feedback/rejected', request.url), 303);
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: 'bad_origin' }, 403);
  if (!env.DATA) return json({ error: 'not_configured' }, 500);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 20_000) return reject(request);

  let form;
  try {
    form = await request.formData();
  } catch {
    return reject(request);
  }

  if (String(form.get('company_website') || '').trim()) {
    return Response.redirect(new URL('/feedback/thanks', request.url), 303);
  }

  const message = String(form.get('message') || '').replace(/[\u0000-\u0008]/g, '').trim();
  const email = String(form.get('email') || '').trim();
  const page = String(form.get('page') || '').trim().slice(0, 80);
  if (!message || message.length > 2000 || containsTfnPhrase(message) || containsTfnPhrase(email)) return reject(request);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reject(request);

  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const bucket = `${ip}:${new Date().toISOString().slice(0, 13)}`;
  const rateKey = keys.feedbackRate(bucket);
  const count = Number(await env.DATA.get(rateKey) || '0');
  if (count >= 8) return reject(request);
  await env.DATA.put(rateKey, String(count + 1));

  const id = crypto.randomUUID();
  await env.DATA.put(keys.feedback(`${new Date().toISOString()}_${id}`), JSON.stringify({
    id,
    message,
    email: email || null,
    page,
    createdAt: new Date().toISOString(),
  }));
  return Response.redirect(new URL('/feedback/thanks', request.url), 303);
}
