import { brand } from '../config/brand.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';
import { packFromAnswers } from '../lib/guide/pack.js';

export function renderReport() {
  const examples = packFromAnswers({
    reason: 'starting',
    entityType: 'sole-trader',
    givenName: 'Alex',
    familyName: 'Nguyen',
    tradingName: 'Harbour & Co',
    activity: 'Example only — mobile coffee cart at weekend markets.',
    state: 'NSW',
    startDate: '2026-12-01',
    email: 'alex@example.com',
    phone: '0400 000 000',
    suburb: 'Wollongong',
    postcode: '2500',
    gst: 'unsure',
  });
  const rows = examples.map((row) => `
    <div class="field" id="field-${escapeHtml(row.id)}">
      <div class="field-top">
        <h2>${escapeHtml(row.label)}</h2>
        <button type="button" class="btn btn-small" data-copy="${escapeHtml(row.id)}">Copy</button>
      </div>
      <p class="field-value is-example" data-field="${escapeHtml(row.id)}">${escapeHtml(row.value)}</p>
    </div>`).join('');

  const main = `
    <section class="page-head">
      <div class="wrap prose">
        <p class="todo" role="note"><strong>Placeholder pack.</strong> These labels follow the public ABN application topics. They are not a guaranteed match of every screen on the official form.</p>
        <h1>Your application pack</h1>
        <p>Copy a line, or copy the whole pack, then paste it into the free official application. This page loaded because this browser has a paid entitlement. It is still not a government website.</p>
        <p id="pack-note" class="callout">Showing an example until your guide answers are found in this browser. Complete the guide on this device to replace the example.</p>
        <div class="cta-row no-print">
          <button type="button" class="btn btn-secondary" id="copy-all">Copy whole pack</button>
          <a class="btn btn-primary" href="${escapeHtml(brand.officialAbnUrl)}" rel="noopener noreferrer">Continue to the free official ABN application<span class="sr-only"> (opens in a new tab)</span></a>
        </div>
        <p class="fine">GST registration is your decision. The general $75,000 turnover figure is public information, not advice. Street details you left blank should be typed only on the official form. Do not paste a tax file number into this page.</p>
        <h2>Name check</h2>
        <p id="name-advice">General information, not legal advice. These lights are not a clearance to use the name, and this page does not lodge an application or fill in a government form.</p>
        <form id="name-risk-form" class="stack">
          <label for="risk-name">Name to check</label>
          <input id="risk-name" name="name" maxlength="180" autocomplete="off" required placeholder="e.g. Harbour & Co">
          <button class="btn btn-primary" type="submit">Run the checks</button>
          <p id="name-risk-error" class="form-error" hidden></p>
        </form>
        <div id="name-risk-results" class="results" aria-live="polite"></div>
      </div>
    </section>
    <section>
      <div class="wrap pack" id="pack">${rows}</div>
    </section>`;

  return renderDocument({
    title: 'Application pack',
    description: `Copy-ready ABN application details prepared by ${brand.name}. Private guide, not the official form.`,
    path: '/report',
    main,
    scripts: ['/assets/report.js'],
    noindex: true,
  });
}
