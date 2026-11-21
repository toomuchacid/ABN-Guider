import { brand, formatAud } from '../config/brand.js';
import { faq, home } from '../content/copy.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';

function sampleRows() {
  const rows = [
    ['green', 'Available', '.au domain', 'Illustration only — no exact match in this drawing.'],
    ['amber', 'Similar', '.com domain', 'Illustration only — a nearby name would need a closer look.'],
    ['red', 'Taken', 'Business name', 'Illustration only — a matching record would show in red.'],
    ['neutral', 'Check failed', 'Trade marks', 'A failed check stays grey. It is never shown as available.'],
  ];
  return rows.map(([tone, label, source, detail]) => `
    <li class="risk risk-${tone}">
      <span class="pill">${escapeHtml(label)}</span>
      <div>
        <p class="risk-source">${escapeHtml(source)}</p>
        <p>${escapeHtml(detail)}</p>
      </div>
    </li>`).join('');
}

export function renderHome() {
  const steps = home.steps.map((step, index) => `
    <li class="step-card">
      <span class="step-no">${index + 1}</span>
      <h3>${escapeHtml(step.title)}</h3>
      <p>${escapeHtml(step.body)}</p>
    </li>`).join('');
  const separate = home.separate.map((item) => `
    <li>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.detail)}</p>
    </li>`).join('');
  const included = home.included.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const excluded = home.excluded.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const questions = faq.map((item) => `
    <details class="faq">
      <summary>${escapeHtml(item.q)}</summary>
      <p>${escapeHtml(item.a)}</p>
    </details>`).join('');

  const main = `
    <section class="hero">
      <div class="wrap hero-grid">
        <div>
          <p class="eyebrow">${escapeHtml(home.eyebrow)}</p>
          <h1>${escapeHtml(home.title)}</h1>
          <p class="lede">${escapeHtml(home.lede)}</p>
          <div class="cta-row">
            <a class="btn btn-primary" href="/name-check">Try the name check</a>
            <a class="btn btn-secondary" href="/guide">Start the ABN guide</a>
          </div>
          <p class="price-note">${escapeHtml(home.priceNote)}</p>
        </div>
        <aside class="panel" aria-label="Illustration of how a name check reads">
          <p class="panel-kicker">Illustration, not a live search</p>
          <h2>How a result reads</h2>
          <ol class="risk-list">${sampleRows()}</ol>
        </aside>
      </div>
    </section>
    <section class="band">
      <div class="wrap">
        <h2>Three steps, then the official form</h2>
        <ol class="steps">${steps}</ol>
        <p class="honesty">${escapeHtml(home.honesty)}</p>
      </div>
    </section>
    <section>
      <div class="wrap">
        <h2>An ABN is not a business name</h2>
        <p class="section-intro">People often pay a third party for something the government does for free, or assume one registration covers the name everywhere. These are separate.</p>
        <ul class="split-list">${separate}</ul>
      </div>
    </section>
    <section class="band" id="pricing">
      <div class="wrap pricing-grid">
        <div>
          <h2>One payment. Then you’re done.</h2>
          <p class="price">${formatAud()}</p>
          <p>Pay once for the copy-ready pack. The ABN application on the government site stays free. No account, no subscription.</p>
          <a class="btn btn-primary" href="/unlock">Unlock the pack</a>
        </div>
        <div class="panel">
          <h3>Included</h3>
          <ul class="tick">${included}</ul>
          <h3>Not included</h3>
          <ul class="cross">${excluded}</ul>
        </div>
      </div>
    </section>
    <section>
      <div class="wrap prose">
        <h2>Questions</h2>
        ${questions}
      </div>
    </section>
    <section class="band">
      <div class="wrap closing">
        <h2>Start with the free teaser</h2>
        <p>See the sample name check, or answer the guide on this device. Pay only if you want the formatted pack.</p>
        <div class="cta-row">
          <a class="btn btn-primary" href="/name-check">Check a name</a>
          <a class="btn btn-secondary" href="/guide">Prepare the ABN answers</a>
        </div>
      </div>
    </section>`;

  return renderDocument({
    title: brand.name,
    description: `${brand.name} is a private Australian guide that explains a business name check and prepares the details for the free official ABN application. Not a government website.`,
    path: '/',
    main,
  });
}
