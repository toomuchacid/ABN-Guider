# Operations runbook

This is how to deploy and operate Startup Savvy. It is an operator’s note, not a customer document. Secret values do not belong in this file, in git, or in a pull request.

The site is a Cloudflare Worker named `startup-savvy`. Static pages are built into `dist/`. `worker/index.js` routes `/api/*`, `/unlock/return` and `/report`. The paid pack is refused unless the signed cookie matches a KV record with status `paid`.

## Deploy

Pushes to `main` run Workers Builds, which runs `npx wrangler deploy`. Every other branch runs `npx wrangler preview`.

`wrangler.toml` sets `workers_dev = true` and `preview_urls = true`. A deploy that drops either flag turns those hostnames off. The KV binding `DATA` is declared twice, at the top level and under `[previews]`, because a preview does not copy the top-level binding. The namespace id is in that file. Do not replace it unless you create a new namespace and mean to.

Local check before a risky change:

```bash
npm test
npm run build
```

`npm run dev` uses `wrangler.pages.toml` so Pages-style `/functions` still load. Production traffic uses the Worker entry, which calls the same handlers.

Production hostname: `https://startup-savvy.toomuchacid.workers.dev/`. A branch preview uses `https://<branch-alias>-startup-savvy.toomuchacid.workers.dev/`.

## Secrets

Set these with `wrangler secret put <NAME>`. Names only:

| Name | Used for |
| --- | --- |
| `STRIPE_SECRET_KEY` | Checkout Sessions. Test key until the owner switches to live. Prefer a restricted key. |
| `STRIPE_WEBHOOK_SECRET` | Signature check on `/api/stripe/webhook`. |
| `COOKIE_SECRET` | HMAC for the `ss_entitlement` cookie. 32+ random characters. |
| `ABR_GUID` | ABN Lookup search. If it is missing, the paid report shows an amber “not yet available” row. |
| `IPA_CLIENT_ID` | Optional IP Australia trade mark API. |
| `IPA_CLIENT_SECRET` | Optional. Pair with the client id. |
| `IPA_ENV` | Must be exactly `test` or the trade mark API is not called. |

`ENABLE_PAYMENT_SIMULATION=true` is local `.dev.vars` only. Do not set it on the Worker. The simulate route also refuses any host that is not localhost.

Questionnaire answers are not a secret and are not a Worker variable. They stay in the browser.

## Stripe sandbox to live

Do this only when the owner decides to take real payments. Do not do it from a pull request, and do not paste a live key into chat or git.

1. In the Stripe Dashboard, use the live account the business owns. Create a restricted key that can create and retrieve Checkout Sessions. Prefer that over a full secret key.
2. `wrangler secret put STRIPE_SECRET_KEY` and paste the live key at the prompt.
3. Add a live webhook endpoint aimed at `https://<production-host>/api/stripe/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` and `charge.refunded`.
4. `wrangler secret put STRIPE_WEBHOOK_SECRET` with that endpoint’s signing secret.
5. Confirm `ENABLE_PAYMENT_SIMULATION` is unset on the Worker.
6. Make one small live purchase the owner has approved, open `/report`, then refund it in the Dashboard and confirm `/report` sends the browser back to `/unlock`.
7. Keep the test-mode webhook and test keys for the sandbox. Do not point the live webhook at a preview URL.

`automatic_tax` stays off until the business has an active GST registration. Turning it on without that registration makes Stripe collect no tax while the settings look like tax is on.

## Refunds

A full refund is the event `charge.refunded` with `refunded: true`. The handler in `src/lib/payments/fulfill.js` sets the KV record to `status: "refunded"` and stores `refundedAt`. It does not delete the record.

`requestHasPaidEntitlement` allows the cookie only when that record is `paid`. After a refund the cookie stops working. A replay of the original paid event does not turn a refunded record back to paid.

The public refund page is a draft. Australian Consumer Law guarantees still apply. A lawyer should review `docs/legal-review.md` before the owner relies on the draft wording.

## Entitlement revocation

Refunding is the normal revocation. To revoke without a refund:

1. Find the entitlement id. It is in the Stripe session metadata `entitlement_id`, and the KV key is `entitlement:{id}`.
2. In the Cloudflare dashboard, delete that key, or set the JSON `status` to something other than `paid` (use `refunded` if you want the same behaviour as a refund).
3. The browser cookie is not enough on its own. The next request to `/report` or `/api/name-check` redirects or returns 401.

There is no admin UI. Do this in the dashboard, not by logging the person’s questionnaire. The questionnaire is not in KV.

## Incidents

Checkout answers `not_configured` when `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is missing. That is expected until both exist.

Webhook responses of 400 usually mean the signing secret does not match the endpoint that sent the event. Check the live endpoint and the test endpoint are not swapped.

Name-check rows stay amber or error when a register is down, times out, or the GUID is missing. Do not “fix” that by painting them green. DNS uses Cloudflare DNS-over-HTTPS. WHOIS is not scraped.

Do not log questionnaire answers, dates of birth, or the ABN Lookup GUID. The GUID is posted to the ABR as a form body and must not be written to logs. The Worker logs an error name, not the request body.

If a bad deploy ships, Workers Builds keeps previous versions in the Cloudflare dashboard. Roll back there, then revert the git commit on `main`.

## Where logs live

- Cloudflare dashboard → Workers & Pages → `startup-savvy` → Observability (or Logs). Production and preview are separate.
- Deploy logs: the Workers Builds page for that Worker, linked from the GitHub check “Workers Builds: startup-savvy”.
- Local: `npx wrangler tail` against the Worker, or the terminal running `npm run dev`.

KV holds entitlements, Stripe session indexes, webhook event ids, feedback messages, name-check cache and a small rate-limit counter. It does not hold the questionnaire.
