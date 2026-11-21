import { brand } from '../config/brand.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';

export function renderGuide() {
  const main = `
    <section class="page-head">
      <div class="wrap prose">
        <p class="todo" role="note"><strong>TODO:</strong> the questions are a working stub. Field wording will be checked against the live ABR application in a later phase. The official form remains the source of truth.</p>
        <h1>ABN application guide</h1>
        <p>Answer a few questions and we’ll line them up with the topics on the free ABN application. Your answers stay in this browser. They are not sent to our server.</p>
        <p class="callout">The official form may ask for a tax file number. Type that only on register.business.gov.au. ${escapeHtml(brand.name)} never asks for a TFN, and this guide will stop you if a number looks like one.</p>
      </div>
    </section>
    <section>
      <div class="wrap">
        <div id="guide-app">
          <noscript>
            <p class="callout">Turn on JavaScript to use the guide. The questions cover why you are applying, entity type, names, activity, location, contact details and a GST prompt. We don’t ask for a tax file number.</p>
          </noscript>
        </div>
      </div>
    </section>`;
  return renderDocument({
    title: 'ABN guide',
    description: 'Guided questions that line up with the free Australian ABN application. Answers stay on your device. Not a government form.',
    path: '/guide',
    main,
    scripts: ['/assets/guide.js'],
  });
}
