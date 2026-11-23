import { brand } from '../config/brand.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';
import { packFromAnswers } from '../lib/guide/pack.js';
import { CHECKLIST, whatHappensNext } from '../lib/guide/questions.js';

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
    associates: 'no',
    dateOfBirth: '1990-01-01',
    addressType: 'mobile',
    nameIntent: 'register',
    turnover: 'unsure',
    gst: 'unsure',
  });
  const rows = examples.map((row) => `
    <div class="field" id="field-${escapeHtml(row.id)}">
      <div class="field-top">
        <h2>${escapeHtml(row.label)}</h2>
        <button type="button" class="btn btn-small" data-copy="${escapeHtml(row.id)}">Copy</button>
      </div>
      <p class="field-value is-example" data-field="${escapeHtml(row.id)}" data-example="${escapeHtml(row.value)}">${escapeHtml(row.value)}</p>
    </div>`).join('');

  const checks = CHECKLIST.map((item) => `
    <label class="check">
      <input type="checkbox" id="check-${escapeHtml(item.id)}">
      <span>${escapeHtml(item.label)}</span>
    </label>`).join('');
  const next = whatHappensNext().map((item) => `
    <li>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      ${item.href ? `<p><a href="${escapeHtml(item.href)}" rel="noopener noreferrer">Official page<span class="sr-only"> (opens in a new tab)</span></a></p>` : ''}
    </li>`).join('');

  const main = `
    <section class="page-head">
      <div class="wrap prose">
        <h1>Your application pack</h1>
        <p class="callout">Not tax, legal or financial advice. ABN registration is free at <a href="${escapeHtml(brand.abrUrl)}">abr.gov.au</a>. You copy these values into the official form yourself. This page does not fill, submit or call an ABR, ASIC or ATO form.</p>
        <p>This page loaded because this browser has a paid entitlement. It is still not a government website. Your answers stay in this browser. They are not sent to our server.</p>
      </div>
    </section>
    <section class="no-print">
      <div class="wrap">
        <div id="guide-app" data-paid="true">
          <noscript>
            <p class="callout">Turn on JavaScript to answer the sole-trader questions. The answers stay in this browser.</p>
          </noscript>
        </div>
      </div>
    </section>
    <section id="summary">
      <div class="wrap">
        <h2>Copy-ready summary</h2>
        <p id="pack-note" class="callout">Showing an example until you save answers in this browser. The example is not your application.</p>
        <div class="cta-row no-print">
          <button type="button" class="btn btn-secondary" id="copy-all">Copy whole pack</button>
          <a class="btn btn-primary" href="${escapeHtml(brand.officialAbnUrl)}" rel="noopener noreferrer">Continue to the free official ABN application<span class="sr-only"> (opens in a new tab)</span></a>
          <button type="button" class="btn btn-secondary" id="delete-answers-pack">Delete my answers</button>
        </div>
        <p id="delete-pack-note" class="fine no-print" hidden>This removes the answers stored in this browser. It does not contact us, and it does not change anything on a government site.</p>
        <p class="no-print"><button type="button" class="btn btn-secondary" id="delete-answers-pack-confirm" hidden>Confirm delete</button></p>
        <p class="fine">To save a PDF, use the browser’s print dialog and choose Save as PDF. There is no file from our server. <span id="email-stub">Emailing this pack is not available.</span></p>
        <div class="pack" id="pack">${rows}</div>
      </div>
    </section>
    <section>
      <div class="wrap prose">
        <h2>Checklist</h2>
        <div id="checklist">${checks}</div>
        <h2>Name check</h2>
        <p id="name-advice">General information, not legal advice. These lights are not a clearance to use the name, and this page does not lodge an application or fill in a government form.</p>
        <form id="name-risk-form" class="stack no-print">
          <label for="risk-name">Name to check</label>
          <input id="risk-name" name="name" maxlength="180" autocomplete="off" required placeholder="e.g. Harbour & Co">
          <button class="btn btn-primary" type="submit">Run the checks</button>
          <p id="name-risk-error" class="form-error" role="alert" hidden></p>
        </form>
        <div id="name-risk-results" class="results" aria-live="polite"></div>
        <h2>What happens next</h2>
        <ol class="next-list">${next}</ol>
      </div>
    </section>`;

  return renderDocument({
    title: 'Application pack',
    description: `Copy-ready ABN application details prepared by ${brand.name}. Private guide, not the official form.`,
    path: '/report',
    main,
    scripts: ['/assets/guide.js', '/assets/report.js'],
    noindex: true,
  });
}
