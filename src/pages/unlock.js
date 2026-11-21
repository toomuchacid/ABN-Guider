import { brand, formatAud } from '../config/brand.js';
import { paymentDisclosure } from '../content/copy.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';

export function renderUnlock() {
  const points = paymentDisclosure.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>Unlock the application pack</h1>
        <p class="lede">You pay ${formatAud()} once for the copy-ready pack on this private site. You are not paying the government, and you are not buying an ABN.</p>
        <form class="panel pay-panel" method="post" action="/api/checkout">
          <h2>Read this before you pay</h2>
          <ul class="disclosure">${points}</ul>
          <p id="cancelled-note" class="callout" hidden>Payment was cancelled. You have not been charged by this page.</p>
          <p id="form-error" class="form-error" hidden>Tick the box to confirm you understand the disclosure.</p>
          <label class="check">
            <input type="checkbox" name="acknowledged" value="yes" required>
            <span>I understand ${escapeHtml(brand.name)} is a private guide and is not part of the ATO, ABR, ASIC or IP Australia; that an ABN application is free on the official website; and that this pack is general information, not tax, legal or financial advice.</span>
          </label>
          <button class="btn btn-primary" type="submit">Continue to payment · ${formatAud()}</button>
          <p class="fine">Card details are entered on Stripe’s page, not here. By continuing you agree to the draft <a href="/terms">terms</a>, <a href="/disclaimer">disclaimer</a> and <a href="/refunds">refund policy</a>.</p>
        </form>
      </div>
    </section>`;
  return renderDocument({
    title: 'Unlock the pack',
    description: `Pay ${formatAud()} once for the private ${brand.name} application pack. ABN registration itself is free on the official site.`,
    path: '/unlock',
    main,
    scripts: ['/assets/unlock.js'],
  });
}
