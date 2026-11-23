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
import { contentSecurityPolicy } from '../src/lib/security-headers.js';
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
