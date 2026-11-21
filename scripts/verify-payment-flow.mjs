/**
 * End-to-end check against `wrangler pages dev`.
 * Builds the site, starts wrangler if BASE_URL is not already set,
 * then walks disclosure -> simulated Checkout -> signed webhook -> entitlement -> paid page.
 *
 * Expects ENABLE_PAYMENT_SIMULATION=true and localhost. No Stripe account is required.
 */
import { spawn } from 'node:child_process';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hmacSha256Hex } from '../src/lib/payments/signature.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT || '8788';
const base = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const startedHere = !process.env.BASE_URL;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadDevVars(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function cookiePair(response) {
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  assert(cookies.length > 0, 'expected a Set-Cookie header');
  return cookies.map((line) => line.split(';')[0]).join('; ');
}

async function signedPost(secret, event) {
  const rawBody = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const response = await fetch(`${base}/api/stripe/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
    },
    body: rawBody,
  });
  const body = await response.json();
  return { response, body };
}

async function ensureDevVars() {
  const file = path.join(root, '.dev.vars');
  try {
    return loadDevVars(await readFile(file, 'utf8'));
  } catch {
    await copyFile(path.join(root, '.dev.vars.example'), file);
    return loadDevVars(await readFile(file, 'utf8'));
  }
}

function startWrangler() {
  const child = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', port], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
  });
  let logs = '';
  const collect = (chunk) => {
    logs += chunk.toString();
    if (logs.length > 20_000) logs = logs.slice(-20_000);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  return { child, logs: () => logs };
}

async function waitForServer(logs) {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    try {
      const response = await fetch(`${base}/`);
      if (response.ok) return;
    } catch {
      // wrangler is still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`wrangler did not start\n${logs()}`);
}

function stopWrangler(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

async function main() {
  const devVars = await ensureDevVars();
  const secret = devVars.STRIPE_WEBHOOK_SECRET;
  assert(secret && secret.length >= 8, 'STRIPE_WEBHOOK_SECRET missing from .dev.vars');

  if (!startedHere) {
    await checks(secret);
    return;
  }

  const build = spawn('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
  const buildCode = await new Promise((resolve) => build.on('exit', resolve));
  assert(buildCode === 0, 'build failed');

  const server = startWrangler();
  try {
    await waitForServer(server.logs);
    await checks(secret);
    console.log('Payment flow verified.');
  } catch (error) {
    console.error(server.logs());
    throw error;
  } finally {
    stopWrangler(server.child);
  }
}

async function checks(secret) {
  const home = await fetch(`${base}/`);
  assert(home.status === 200, `home status ${home.status}`);
  const homeHtml = await home.text();
  assert(homeHtml.toLowerCase().includes('not a government website'), 'home is missing the private-site notice');

  const privacy = await fetch(`${base}/privacy`);
  const privacyHtml = await privacy.text();
  assert(privacy.status === 200 && privacyHtml.includes('Draft for product development'), 'privacy draft missing');
  assert(privacyHtml.toLowerCase().includes('tax file number'), 'privacy page does not mention TFNs');

  const locked = await fetch(`${base}/report`, { redirect: 'manual' });
  assert([301, 302, 303, 307, 308].includes(locked.status), `locked report should redirect, got ${locked.status}`);
  assert(new URL(locked.headers.get('location'), base).pathname === '/unlock', 'locked report should send people to /unlock');

  const checkout = await fetch(`${base}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ acknowledged: true }),
  });
  const checkoutBody = await checkout.json();
  assert(checkout.status === 200, `checkout status ${checkout.status} ${JSON.stringify(checkoutBody)}`);
  assert(String(checkoutBody.url).includes('/api/dev/simulate-payment?session_id=sim_'), `unexpected checkout url ${checkoutBody.url}`);

  const simulated = await fetch(checkoutBody.url, { redirect: 'manual' });
  assert(simulated.status === 303, `simulate status ${simulated.status}`);
  const returned = await fetch(new URL(simulated.headers.get('location'), base), { redirect: 'manual' });
  assert(returned.status === 303, `return status ${returned.status} ${await returned.text()}`);
  assert(new URL(returned.headers.get('location'), base).pathname === '/report', 'paid return should open the pack');
  const paidCookie = cookiePair(returned);
  const report = await fetch(`${base}/report`, { headers: { cookie: paidCookie } });
  const reportHtml = await report.text();
  assert(report.status === 200, `paid report status ${report.status}`);
  assert(reportHtml.includes('Your application pack'), 'paid page missing the pack');
  assert(reportHtml.toLowerCase().includes('not a government website'), 'paid page missing the private-site notice');

  const bad = await fetch(`${base}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=deadbeef' },
    body: '{"id":"evt_bad","type":"checkout.session.completed"}',
  });
  assert(bad.status === 400, `bad signature should be 400, got ${bad.status}`);

  const entitlementId = crypto.randomUUID();
  const sessionId = `sim_${crypto.randomUUID().replaceAll('-', '')}`;
  const paymentIntentId = `pi_sim_${sessionId.slice(4)}`;
  const unpaid = await signedPost(secret, {
    id: 'evt_verify_unpaid',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'unpaid',
        metadata: { entitlementId },
        payment_intent: paymentIntentId,
      },
    },
  });
  assert(unpaid.response.status === 200, `unpaid webhook ${unpaid.response.status}`);
  assert(unpaid.body.result?.fulfilled === false, 'unpaid webhook granted access');
  const pending = await fetch(`${base}/unlock/return?session_id=${sessionId}`, { redirect: 'manual' });
  assert(pending.status === 200, `unpaid return should keep waiting, got ${pending.status}`);

  const paid = await signedPost(secret, {
    id: 'evt_verify_paid',
    type: 'checkout.session.async_payment_succeeded',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
        metadata: { entitlementId },
        payment_intent: paymentIntentId,
      },
    },
  });
  assert(paid.response.status === 200 && paid.body.result?.fulfilled === true, `paid webhook failed ${JSON.stringify(paid.body)}`);
  const again = await signedPost(secret, {
    id: 'evt_verify_paid',
    type: 'checkout.session.async_payment_succeeded',
    data: {
      object: {
        id: sessionId,
        payment_status: 'paid',
        metadata: { entitlementId },
        payment_intent: paymentIntentId,
      },
    },
  });
  assert(again.body.duplicate === true, 'replayed event was not treated as a duplicate');

  const granted = await fetch(`${base}/unlock/return?session_id=${sessionId}`, { redirect: 'manual' });
  assert(granted.status === 303, `signed webhook did not unlock, status ${granted.status}`);
  const grantedReport = await fetch(`${base}/report`, { headers: { cookie: cookiePair(granted) } });
  assert(grantedReport.status === 200, 'report stayed locked after a signed paid webhook');

  const refund = await signedPost(secret, {
    id: 'evt_verify_refund',
    type: 'charge.refunded',
    data: { object: { object: 'charge', payment_intent: paymentIntentId, refunded: true } },
  });
  assert(refund.response.status === 200 && refund.body.result?.revoked === true, `refund failed ${JSON.stringify(refund.body)}`);
  const revoked = await fetch(`${base}/report`, {
    headers: { cookie: cookiePair(granted) },
    redirect: 'manual',
  });
  assert([301, 302, 303, 307, 308].includes(revoked.status), 'refunded entitlement could still open the pack');

  const feedback = await fetch(`${base}/api/feedback`, {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: 'The sample name check is clearly marked.', page: '/feedback' }),
    redirect: 'manual',
  });
  assert(feedback.status === 303, `feedback status ${feedback.status}`);
  assert(new URL(feedback.headers.get('location'), base).pathname === '/feedback/thanks', 'feedback did not redirect to thanks');

  const tfn = await fetch(`${base}/api/feedback`, {
    method: 'POST',
    headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message: '123456789' }),
    redirect: 'manual',
  });
  assert(new URL(tfn.headers.get('location'), base).pathname === '/feedback/rejected', 'a TFN-shaped message was accepted');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
