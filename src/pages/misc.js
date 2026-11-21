import { brand } from '../config/brand.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';

export function renderNotFound() {
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>That page isn’t here</h1>
        <p>The link may be old. The official ABN application is still at register.business.gov.au — this site can’t lodge it for you.</p>
        <a class="btn btn-primary" href="/">Go to the home page</a>
      </div>
    </section>`;
  return renderDocument({
    title: 'Page not found',
    description: `This page is not on the ${brand.name} site.`,
    path: '/404',
    main,
    noindex: true,
  });
}

export function renderPendingPayment({ attempt, sessionId }) {
  const refresh = attempt < 8
    ? `<meta http-equiv="refresh" content="3;url=/unlock/return?session_id=${encodeURIComponent(sessionId)}&amp;attempt=${attempt + 1}">`
    : '';
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>Confirming the payment</h1>
        <p>Access is unlocked only after the signed payment notification says the payment succeeded. Landing on this page is not enough, and you have not been given the pack yet.</p>
        <p>${attempt < 8 ? 'This page checks again every few seconds.' : 'It’s still not confirmed. Wait a moment, then reload. If you closed the payment window, start again from the unlock page.'}</p>
        <a class="btn btn-secondary" href="/unlock/return?session_id=${encodeURIComponent(sessionId)}">Check again</a>
      </div>
    </section>`;
  const html = renderDocument({
    title: 'Confirming payment',
    description: 'Waiting for payment confirmation.',
    path: '/unlock/return',
    main,
    noindex: true,
  });
  return html.replace('</head>', `${refresh}</head>`);
}

export function renderMissingSession() {
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>We couldn’t find that payment</h1>
        <p>Start again from the unlock page. If you already paid, open the return link from the same browser. The pack is unlocked only after the signed payment notification says the payment succeeded.</p>
        <a class="btn btn-secondary" href="/unlock">Back to unlock</a>
      </div>
    </section>`;
  return renderDocument({
    title: 'Payment not found',
    description: 'No matching payment was found.',
    path: '/unlock/return',
    main,
    noindex: true,
  });
}

export function renderConfigError() {
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>Payments are not configured</h1>
        <p>This server is missing a payment setting. Nothing has been unlocked. Check the deployment environment variables described in the README. The message deliberately does not list secret names or values.</p>
        <a class="btn btn-secondary" href="/unlock">Back</a>
      </div>
    </section>`;
  return renderDocument({
    title: 'Payments not configured',
    description: `Payments are not configured on this ${escapeHtml(brand.name)} server.`,
    path: '/unlock/return',
    main,
    noindex: true,
  });
}
