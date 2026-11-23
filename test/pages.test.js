import { describe, expect, it } from 'vitest';
import { formatAud } from '../src/config/brand.js';
import { renderFeedback } from '../src/pages/feedback.js';
import { renderGuide } from '../src/pages/guide.js';
import { renderHome } from '../src/pages/home.js';
import { renderLegal } from '../src/pages/legal.js';
import { renderNameCheck } from '../src/pages/name-check.js';
import { renderReport } from '../src/pages/report.js';
import { renderUnlock } from '../src/pages/unlock.js';
import { packFromAnswers } from '../src/lib/guide/pack.js';
import { buildCheckoutFields, makeIntegrationId } from '../src/lib/payments/checkout-form.js';
import { renderPendingPayment } from '../src/pages/misc.js';
import { contentSecurityPolicy, headersFile } from '../src/lib/security-headers.js';
import { containsTfnPhrase } from '../src/lib/privacy/tfn.js';

describe('pages', () => {
  it('marks the site as private on every primary page and drafts the legal pages', () => {
    for (const html of [renderHome(), renderNameCheck(), renderGuide(), renderUnlock(), renderReport(), renderLegal('privacy')]) {
      expect(html.toLowerCase()).toContain('not a government website');
      expect(html.toLowerCase()).toContain('not affiliated');
    }
    for (const id of ['terms', 'privacy', 'disclaimer', 'refunds']) {
      const html = renderLegal(id);
      expect(html).toContain('Draft for product development');
      expect(html.toLowerCase()).toContain('lawyer');
    }
    expect(renderLegal('privacy').toLowerCase()).toContain('tax file number');
    expect(renderLegal('disclaimer')).toContain('register.business.gov.au');
    expect(renderUnlock()).toContain(formatAud());
    expect(renderUnlock().toLowerCase()).toContain('not tax, legal or financial advice');
    expect(renderNameCheck().toLowerCase()).toContain('not a live register search');
    expect(renderNameCheck()).not.toContain('risk-green');
    expect(renderHome()).not.toContain('risk-green');
    expect(renderReport().toLowerCase()).toContain('not legal advice');
    expect(renderReport()).toContain('noindex');
    expect(renderFeedback().toLowerCase()).toContain('tax file number');
  });

  it('lets only the unlock page post to Stripe Checkout', () => {
    const stripeFormAction = "form-action 'self' https://checkout.stripe.com";
    const unlockPolicy = contentSecurityPolicy({ allowStripeCheckout: true });
    expect(unlockPolicy).toContain(stripeFormAction);
    expect(unlockPolicy).toContain("connect-src 'self'");
    expect(unlockPolicy).not.toContain('frame-src');
    expect(contentSecurityPolicy()).toContain("form-action 'self'");
    expect(contentSecurityPolicy()).not.toContain('checkout.stripe.com');
    const unlockHtml = renderUnlock().replaceAll('&#39;', "'");
    expect(unlockHtml).toContain(stripeFormAction);
    expect(renderHome().replaceAll('&#39;', "'")).not.toContain('checkout.stripe.com');

    const headers = headersFile();
    const unlockHeader = headers.split('\n\n').find((block) => block.startsWith('/unlock\n'));
    expect(unlockHeader).toContain(stripeFormAction);
    const siteHeader = headers.split('\n\n').find((block) => block.startsWith('/*\n'));
    expect(siteHeader).toContain("form-action 'self'");
    expect(siteHeader).not.toContain('checkout.stripe.com');
    const returnHeader = headers.split('\n\n').find((block) => block.startsWith('/unlock/return\n'));
    expect(returnHeader).not.toContain('checkout.stripe.com');

    const pending = renderPendingPayment({ attempt: 0, sessionId: 'cs_test_example' }).replaceAll('&#39;', "'");
    expect(pending).toContain("form-action 'self'");
    expect(pending).not.toContain('checkout.stripe.com');
    expect(pending).toContain('/unlock/return?session_id=cs_test_example');
    const fields = Object.fromEntries(buildCheckoutFields({
      origin: 'https://startup-savvy.example',
      entitlementId: '11111111-1111-4111-8111-111111111111',
      integrationId: makeIntegrationId('abcdefgh'),
    }));
    expect(fields.success_url).toBe('https://startup-savvy.example/unlock/return?session_id={CHECKOUT_SESSION_ID}');
    expect(fields.cancel_url).toBe('https://startup-savvy.example/unlock?cancelled=1');
  });

  it('keeps analytics local and does not render a TFN as a pack value', () => {
    expect(contentSecurityPolicy()).toContain("script-src 'self'");
    expect(contentSecurityPolicy()).not.toContain('plausible');
    const pack = packFromAnswers({
      reason: 'starting',
      entityType: 'sole-trader',
      givenName: 'Ada',
      familyName: 'Lovelace',
      activity: 'Writes useful software for small shops.',
      state: 'VIC',
      email: 'ada@example.com',
      gst: 'unsure',
    });
    expect(pack.find((row) => row.id === 'legalName').value).toBe('Ada Lovelace');
    expect(containsTfnPhrase('123456789')).toBe(true);
    expect(containsTfnPhrase('TFN 12345678')).toBe(true);
    expect(containsTfnPhrase('2026-12-01')).toBe(false);
    expect(containsTfnPhrase('A coffee cart in Hobart')).toBe(false);
  });
});
