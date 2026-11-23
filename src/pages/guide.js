import { brand } from '../config/brand.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';

export function renderGuide() {
  const main = `
    <section class="page-head">
      <div class="wrap prose">
        <h1>ABN application guide</h1>
        <p>The sole-trader questions are in the paid application pack. This public page does not collect your answers, and it does not send them anywhere.</p>
        <p>Inside the pack, the questions follow the topics the official ABN application asks a sole trader about: who you are, what the business does, when it starts, the address type, GST, and whether you will use your own name or a business name. Each step links to the official page it is based on.</p>
        <p>A company, partnership, trust, or a business with someone else involved, is told that this guide is for sole traders and pointed at the free official application.</p>
        <p class="callout">Not tax, legal or financial advice. ABN registration is free at <a href="${escapeHtml(brand.abrUrl)}">abr.gov.au</a>. ${escapeHtml(brand.name)} does not fill in or lodge the government form.</p>
      </div>
    </section>
    <section>
      <div class="wrap">
        <div class="cta-row">
          <a class="btn btn-primary" href="/unlock">Unlock the pack</a>
          <a class="btn btn-secondary" href="/report">Open the pack if you already have access</a>
        </div>
      </div>
    </section>`;
  return renderDocument({
    title: 'ABN guide',
    description: 'The sole-trader questions are in the paid pack. This page does not collect answers. Not a government form.',
    path: '/guide',
    main,
    scripts: [],
  });
}
