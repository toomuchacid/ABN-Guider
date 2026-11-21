# Startup Savvy

A private, mobile-first Australian website that helps someone starting a business do two things: read a proposed name in plain English, and prepare the details for the free ABN application before handing off to [register.business.gov.au](https://register.business.gov.au/).

This is **not** a government website. It is not affiliated with the ATO, the ABR, ASIC or IP Australia. Applying for an ABN on the official site is free. The paid product is a one-time preparation pack (A$19 by default).

The working brand name is **Startup Savvy**. Change it in [`src/config/brand.js`](src/config/brand.js) only.

## Phase 1

This repository is the platform and payments slice.

- Static pages: home, pricing, FAQ, name-check teaser, ABN questionnaire, unlock disclosure, paid pack, feedback, and draft legal pages.
- Stripe Checkout, created by a Cloudflare Pages Function. Card data stays on Stripe.
- A signed webhook grants the entitlement. Opening the return page does not.
- The pack at `/report` is checked on the server. A valid cookie is not enough if the payment was refunded.
- Cookie-less analytics, off until you set a flag.
- A feedback form stored in KV. Tax file numbers are refused, not stored.

Live register lookups are not in this phase. The name check returns labelled sample rows. Phase 2 adapters (Synergy Wholesale, ABN Lookup, IP Australia, ASIC) should implement the contract in [`src/lib/name-check/contract.js`](src/lib/name-check/contract.js):

```text
input name -> { source, status: available|taken|risk|unknown|error, detail, checkedAt }
```

An upstream error, timeout, or unknown result is `error` or `unknown`. The summary is green only when every row is `available`.

## Layout

```text
src/config/brand.js     name, price, links, analytics flag
src/content/            marketing copy and draft legal text
src/components/         HTML layout (header, footer, government notice)
src/pages/              one renderer per page
src/client/             browser behaviour for the guide, name check, and pack
src/lib/                name-check contract, guide pack, Stripe signature, entitlement
src/styles/site.css
functions/              Pages Functions (checkout, webhook, feedback, paywall)
scripts/build.mjs       writes dist/
test/                   webhook, entitlement, name-check, page copy
```

Pages Functions import `src/lib`. Those modules use Web Crypto and `fetch` only, so the same files can move to another server runtime later.

## Local development

Requires Node 20+.

```bash
npm install
cp .dev.vars.example .dev.vars
npm test
npm run dev
```

`npm run dev` builds `dist/` and runs:

```bash
npx wrangler pages dev dist --ip 127.0.0.1 --port 8788
```

Open http://127.0.0.1:8788 . The example `.dev.vars` turns on a localhost-only payment simulation, so you can click through checkout without a Stripe account. The simulate route still builds a Stripe-shaped event and runs it through the signature checker. It answers 404 on any other hostname, even if the flag is set.

```bash
npm run verify
```

That builds the site, starts wrangler, and checks:

- the home and privacy pages
- `/report` redirects when there is no entitlement
- disclosure → simulated checkout → signed webhook → cookie → paid page
- a bad signature is rejected
- an unpaid session does not unlock the pack
- a refund removes access
- feedback is stored, and a tax-file-number-shaped message is discarded

Set `BASE_URL` if wrangler is already running and you only want the HTTP checks.

## Environment variables

Put these in `.dev.vars` locally and in the Cloudflare Pages project for deployment. `.dev.vars` is gitignored. The placeholders in `.dev.vars.example` are not keys.

| Name | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Restricted test key (`rk_test_...`) with Checkout Sessions write and read. Prefer a restricted key over a secret key (`sk_`). |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/stripe/webhook`. Treat it like an API key. |
| `COOKIE_SECRET` | Long random string (32+ characters) used to sign the entitlement cookie. |
| `ENABLE_PAYMENT_SIMULATION` | `true` only on your machine. Leave it unset in Cloudflare. |

Generate a cookie secret with `openssl rand -base64 32`. Do not commit the result.

There is one KV binding, `DATA`. It holds entitlements (`entitlement:{id}`), session and payment indexes, webhook event ids, and feedback. One namespace is enough at this size. D1 is a better fit later if you need to query feedback or list purchases. KV has no schema migration, which is why Phase 1 uses it.

Local `wrangler pages dev` simulates KV. The id in `wrangler.toml` is a placeholder. Replace it before the first real deploy:

```bash
npx wrangler kv namespace create DATA
```

Paste the id into `wrangler.toml`. That command needs a Cloudflare login, so it is not run by this repo.

## Stripe test setup

Use a [Stripe sandbox](https://docs.stripe.com/sandboxes) for development rather than a shared test mode if you are starting fresh. Do not put live keys in this project.

1. Create a restricted key that can create and retrieve Checkout Sessions.
2. Put it in `STRIPE_SECRET_KEY`.
3. Set `ENABLE_PAYMENT_SIMULATION` to empty or `false` when you want the real Checkout redirect.
4. Add a webhook endpoint pointing at `https://<your-domain>/api/stripe/webhook` (or `stripe listen --forward-to localhost:8788/api/stripe/webhook` for local Stripe CLI forwarding).
5. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
6. Put the endpoint signing secret in `STRIPE_WEBHOOK_SECRET`.

Checkout is created server-side. The price is `brand.priceAudCents` (1900). The request does not send `payment_method_types`, so Stripe can offer the methods enabled in the Dashboard. `automatic_tax` is off: do not turn on Stripe Tax until the business has an active GST registration, or Stripe will collect no tax while the settings look like tax is on. The API version sent is `2026-11-18.endive`, matching the `stripe` package used in the unit tests.

Fulfillment happens in the webhook, and only when `payment_status` is `paid`. A delayed payment method fires `checkout.session.completed` while the session is still `unpaid`; access waits for `checkout.session.async_payment_succeeded`. The return page polls the KV record and sets an HttpOnly cookie only after that record says `paid`. A full refund sets the record to `refunded`, and the cookie stops working.

Before go-live, allowlist [Stripe’s webhook IP addresses](https://docs.stripe.com/ips) on the route as defense in depth. Signature verification is still required.

The disclosure on `/unlock` is required before a session is created. It states that this is a private guide, that an ABN is free on the official site, and that the pack is general information, not tax, legal, or financial advice. The same facts are on the Stripe product description.

## Analytics and feedback

Analytics are off. In `src/config/brand.js`:

```js
analytics: {
  provider: 'none', // 'plausible' or 'cloudflare'
  plausibleDomain: '',
  cloudflareToken: '',
}
```

Plausible and Cloudflare Web Analytics are cookie-less. The build refuses an unsafe domain or token, and the Content Security Policy stays `script-src 'self'` until a provider is set. Rebuild after changing the flag.

Feedback posts to `/api/feedback` and is stored in KV. The form asks people not to include a tax file number. A message that is only an 8 or 9 digit number, or that says “TFN” next to one, is discarded.

Questionnaire answers are kept in `sessionStorage` on the device. They are not uploaded.

## Deploy on Cloudflare Pages

1. Push this repo to GitHub.
2. Create a Pages project from the repo.
3. Build command: `npm run build`. Output directory: `dist`.
4. The `/functions` directory is deployed as Pages Functions. Do not move it into `dist`.
5. Create the KV namespace, set the binding name to `DATA`, and replace the placeholder id.
6. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `COOKIE_SECRET` in the Pages environment. Do not set `ENABLE_PAYMENT_SIMULATION`.
7. Point the Stripe webhook at `https://<project>.pages.dev/api/stripe/webhook` (or the custom domain).
8. Read the draft legal pages with an Australian lawyer before sending traffic.

`_headers` sends a Content Security Policy, `nosniff`, and a no-store cache on `/report`. The paywall is the middleware in `functions/_middleware.js`, not the cache header.

## Legal pages

Terms, privacy, disclaimer, and refunds are drafts. Each page says so. They are written with the Australian Privacy Principles and the Australian Consumer Law in mind, and they say the site never collects a tax file number. They are not a finished legal document.

## Moving to Next.js later

The split is there so a later migration does not have to untangle a framework.

| Now | Next.js |
| --- | --- |
| `src/content/` | Import the same modules, or move the long text to MDX. |
| `src/components/document.js` | `app/layout.tsx`. Keep the government banner in the layout, not per page. |
| `src/pages/*.js` | Server components. The render functions already take no request data. |
| `src/client/*.js` | Client components. The guide and name check already talk to DOM nodes and `sessionStorage`. |
| `src/lib/` | Import unchanged from server code. No Node-only APIs. |
| `functions/api/*` | `app/api/*/route.js`, or leave them on Cloudflare. |
| `functions/_middleware.js` | `middleware.ts`. Keep the paid check on the server. |
| KV | Same key names, or a table with the same fields. |

Do not move `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `COOKIE_SECRET` to `NEXT_PUBLIC_*`. Do not decide entitlement in the browser. The name-check rule (never render an error as available) lives in `src/lib/name-check`, so it stays in force after the rewrite.

## Tests

```bash
npm test
```

The webhook tests check our verifier against headers produced by Stripe’s own library: valid signature, tampered body, wrong secret, expired timestamp, and more than one `v1` signature. Entitlement tests cover unpaid sessions, refunds, replay after a refund, and a tampered cookie.
