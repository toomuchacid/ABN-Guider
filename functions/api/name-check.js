import { keys } from '../../src/lib/ids.js';
import { isSameOrigin, json, readBodyText } from '../../src/lib/http.js';
import { createLiveAdapters } from '../../src/lib/name-check/live.js';
import { runNameCheck } from '../../src/lib/name-check/index.js';
import { readPaidEntitlement } from '../../src/lib/payments/entitlement.js';
import { scrubValue } from '../../src/lib/name-check/support.js';

const HOUR_LIMIT = 20;

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: 'bad_origin' }, 403);
  const paid = await readPaidEntitlement({ request, env });
  if (!paid) return json({ error: 'locked' }, 401);

  const body = await readBodyText(request, 4000);
  if (!body.ok) return json({ error: 'That request was too large.' }, 413);
  let payload;
  try {
    payload = JSON.parse(body.raw || '{}');
  } catch {
    return json({ error: 'Enter a business name.' }, 400);
  }

  const hour = new Date().toISOString().slice(0, 13);
  const rateKey = keys.nameCheckRate(paid.id, hour);
  const count = Number(await env.DATA.get(rateKey) || '0');
  if (count >= HOUR_LIMIT) return json({ error: 'Too many checks from this pack. Try again in a little while.' }, 429);
  await env.DATA.put(rateKey, String(count + 1), { expirationTtl: 7200 });

  const secrets = [env.ABR_GUID, env.IPA_CLIENT_ID, env.IPA_CLIENT_SECRET];
  try {
    const adapters = createLiveAdapters(env, {
      fetchImpl: typeof env.fetchImpl === 'function' ? env.fetchImpl : undefined,
      sleep: typeof env.sleep === 'function' ? env.sleep : undefined,
      gapMs: Number.isFinite(env.gapMs) ? env.gapMs : undefined,
      timeoutMs: Number.isFinite(env.timeoutMs) ? env.timeoutMs : undefined,
      lookup: typeof env.lookup === 'function' ? env.lookup : undefined,
    });
    const outcome = await runNameCheck(payload?.name, adapters);
    const safe = scrubValue({
      ok: outcome.ok,
      error: outcome.error,
      query: outcome.query,
      results: outcome.results,
      summary: outcome.summary,
    }, secrets);
    return json(safe, outcome.ok ? 200 : 400);
  } catch (error) {
    console.error('name_check_failed', error instanceof Error ? error.name : 'error');
    return json({ error: 'The checks could not be completed. That is not a clearance.' }, 500);
  }
}
