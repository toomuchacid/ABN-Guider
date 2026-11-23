# Legal review checklist

This is a list for an Australian lawyer. It is not legal advice, and it is not a sign-off. Startup Savvy is a private site. It is not the ATO, the ABR, ASIC or IP Australia.

The draft customer pages are Terms, Privacy, Disclaimer and Refunds. Each page says it is a draft. Do not treat this checklist as a substitute for reading them.

## Claims and disclosures to read

Confirm each of these is still true, and still allowed, before launch:

- The banner on every page: not a government website, and not affiliated with the ATO, ABR, ASIC or IP Australia.
- “ABN registration is free” at abr.gov.au / the official application, and the A$19 price is only for this private pack.
- “Not tax, legal or financial advice” on the unlock page, the pack, and the FAQ.
- The pack does not fill, submit or call an ABR, ASIC or ATO form. The person copies values themselves.
- The GST sentence: the ATO publishes a A$75,000 turnover threshold for most businesses, the figure can change, and the site does not tell the person whether they must register.
- Name-check wording: DNS “likely registered” and “no DNS found, may be available, confirm with a registrar” are not a clearance. Trade mark and ASIC rows are links unless a real signal exists. A failed check is never shown as available.
- A business name, company, domain and trade mark are separate from an ABN and can have their own fees.
- The guide is for sole traders. Companies, partnerships, trusts and businesses with associates are stopped and sent to the official application.
- “We never ask for a tax file number.” The questionnaire refuses a TFN-shaped answer and does not store it.
- Refund wording on the draft refunds page, including how a full Stripe refund removes access.
- The contact email in `src/config/brand.js` is still `hello@example.com`, and the legal entity name is still a placeholder. Both have to be real before launch.
- Official links on each questionnaire step still point at the right ATO, ABR, business.gov.au, ASIC and ABS pages.

## Draft pages

| Page | What the lawyer is checking |
| --- | --- |
| `/terms` | Who is selling, what is sold, price, no government affiliation, no lodging. |
| `/privacy` | What is collected, what is not, local-only questionnaire, feedback, Stripe, TFN refusal. |
| `/disclaimer` | Not advice, not a clearance of a name, official form is the source of truth. |
| `/refunds` | When a refund is offered, Consumer Law guarantees, what “access removed” means. |
| Home, FAQ, unlock | The same claims are shorter there. They have to match the long pages. |

## Data flows

The lawyer should trace these. None of them should be described as “we don’t collect anything” without the exceptions.

| Flow | Where it goes | Notes |
| --- | --- | --- |
| Sole-trader answers, including date of birth | `localStorage` in the browser only | Not posted to the Worker. Not logged. Delete my answers removes the key. |
| Proposed business name from the public name-check page | `sessionStorage` | Used to pre-fill the paid name check. |
| Paid name check | `POST /api/name-check` sends the name only | Entitlement is checked first. Results may be cached in KV for about 10 minutes. The GUID is not returned. |
| Card payment | Stripe Checkout | Card data stays on Stripe. The Worker stores an entitlement id, status, and the email Stripe sends on the paid event. |
| Entitlement | Signed `ss_entitlement` cookie plus KV record `entitlement:{id}` | The cookie alone is not enough. Refund sets status to `refunded`. |
| Feedback | `POST /api/feedback` into KV | A TFN-shaped message is discarded. |
| Email of the pack | Not implemented | `src/lib/guide/email-stub.js` returns `not_implemented` and does not send. |
| PDF | Browser print → Save as PDF | No server-side PDF. |

## Patent and form-filling

There is no code path that opens, fills or submits an ABR, ASIC or ATO form, and no code path that pre-fills those forms through an API. The questionnaire is the design-around: the person types or pastes into the official application. A reviewer should confirm a future change does not add that path.

## Before this list can be closed

- A named lawyer has read the four draft pages and this list.
- The entity name, ABN of the seller (if any), and contact email are real.
- Any sentence the lawyer rejects is changed in the site, not only in this file.
