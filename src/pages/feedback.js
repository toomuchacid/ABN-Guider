import { brand } from '../config/brand.js';
import { renderDocument } from '../components/document.js';
import { escapeHtml } from '../lib/html.js';

export function renderFeedback() {
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>Feedback</h1>
        <p>Tell us what was confusing. Don’t include a tax file number, a full card number, or identity documents. Messages are stored so we can read them. An email is optional.</p>
        <p id="feedback-error" class="form-error" hidden>We couldn’t save that. Check the message and leave out any tax file number.</p>
        <form class="panel stack" method="post" action="/api/feedback">
          <label for="message">What should we know?</label>
          <textarea id="message" name="message" required maxlength="2000" rows="6"></textarea>
          <label for="email">Email, if you want a reply <span class="optional">(optional)</span></label>
          <input id="email" name="email" type="email" maxlength="120" autocomplete="email">
          <input type="hidden" name="page" value="/feedback">
          <label class="hp">Website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label>
          <button class="btn btn-primary" type="submit">Send feedback</button>
        </form>
        <p class="fine">Or email <a href="mailto:${escapeHtml(brand.contactEmail)}">${escapeHtml(brand.contactEmail)}</a>.</p>
      </div>
    </section>`;
  return renderDocument({
    title: 'Feedback',
    description: `Send feedback about the ${brand.name} guide. Do not include a tax file number.`,
    path: '/feedback',
    main,
    scripts: ['/assets/feedback.js'],
  });
}

export function renderFeedbackThanks() {
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>Thanks, we have it</h1>
        <p>Your note is stored. If you left an email, we can reply there. We don’t attach it to the ABN guide answers, because those stay in your browser.</p>
        <a class="btn btn-secondary" href="/">Back to the home page</a>
      </div>
    </section>`;
  return renderDocument({
    title: 'Feedback sent',
    description: 'Your feedback was stored.',
    path: '/feedback/thanks',
    main,
  });
}

export function renderFeedbackRejected() {
  const main = `
    <section class="page-head">
      <div class="wrap narrow">
        <h1>We didn’t store that</h1>
        <p>The message was empty, too long, or it looked like a tax file number. We never collect TFNs. Write a short comment and try again.</p>
        <a class="btn btn-primary" href="/feedback">Back to feedback</a>
      </div>
    </section>`;
  return renderDocument({
    title: 'Feedback not stored',
    description: 'The feedback message was not stored.',
    path: '/feedback/rejected',
    main,
  });
}
