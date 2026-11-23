# Launch checklist

Items the owner still has to do. This repository cannot do them. Do not paste secret values into an issue or a pull request.

## Access and payments

- [ ] `ABR_GUID` set on the Worker with `wrangler secret put`. Until then, ABN Lookup stays amber and links to abr.business.gov.au.
- [ ] `IPA_CLIENT_ID`, `IPA_CLIENT_SECRET` and `IPA_ENV=test` set only if the trade mark test API should run. Leave them unset to keep the official link.
- [ ] Stripe live verification, done by the owner in the live Stripe account. The steps are in [runbook.md](runbook.md). Do not put a live key in git.
- [ ] One test-card run in the Stripe sandbox: pay, land on `/report`, answer the sole-trader questions, copy a line, run the name check, then refund and confirm `/report` locks again.
- [ ] `COOKIE_SECRET` and `STRIPE_WEBHOOK_SECRET` confirmed present on the production Worker, and `ENABLE_PAYMENT_SIMULATION` confirmed unset.

## Name, domain, registers

- [ ] Domain and registrar purchase. That spend needs the owner’s approval. Nothing in this repo buys a domain.
- [ ] Synergy Wholesale, if a registrar availability check is wanted later. DNS is the signal until then. Do not scrape WHOIS.
- [ ] Replace `hello@example.com` and `[Legal entity name to be confirmed]` in `src/config/brand.js`.

## Legal

- [ ] A lawyer works through [legal-review.md](legal-review.md) and the draft Terms, Privacy, Disclaimer and Refunds.
- [ ] Sign-off is recorded by the owner outside this file. This checklist is not that sign-off.

## After those are done

- [ ] Read the production home, name check, unlock and paid pack on a phone.
- [ ] Confirm the public name-check page still does not show a green light.
- [ ] Confirm Delete my answers clears the pack on that device and does not call the server.
