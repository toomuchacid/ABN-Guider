import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deliverPackByEmail } from '../src/lib/guide/email-stub.js';
import { findTfnField } from '../src/lib/guide/pack.js';
import {
  GST_TURNOVER_THRESHOLD_AUD,
  gstGuidance,
  safeOfficialHref,
  soleTraderRoute,
  validateStep,
} from '../src/lib/guide/questions.js';
import { clearGuideState, readGuideState, writeGuideState } from '../src/lib/guide/storage.js';
import { renderGuide } from '../src/pages/guide.js';
import { renderReport } from '../src/pages/report.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    dump() { return map; },
  };
}

const soleTrader = {
  entityType: 'sole-trader',
  associates: 'no',
  givenName: 'Ada',
  familyName: 'Lovelace',
  dateOfBirth: '1990-01-02',
  activity: 'Repairs bicycles for local commuters.',
  startDate: '2026-12-01',
  addressType: 'home',
  state: 'VIC',
  suburb: 'Fitzroy',
  postcode: '3065',
  email: 'ada@example.com',
  nameIntent: 'own-name',
  gst: 'no',
  turnover: 'under',
};

describe('sole-trader questionnaire', () => {
  it('routes companies and associates away, and lets a sole trader continue', () => {
    expect(soleTraderRoute({ entityType: 'company', associates: 'no' })).toMatchObject({ proceed: false, reason: 'not-sole-trader' });
    expect(soleTraderRoute({ entityType: 'partnership', associates: 'no' }).proceed).toBe(false);
    expect(soleTraderRoute({ entityType: 'sole-trader', associates: 'yes' })).toMatchObject({ proceed: false, reason: 'associates' });
    expect(soleTraderRoute({ entityType: '', associates: '' }).reason).toBe('missing');
    expect(soleTraderRoute(soleTrader)).toMatchObject({ proceed: true, reason: 'sole-trader' });
  });

  it('validates each step and refuses a tax file number', () => {
    expect(validateStep(0, {}).errors[0]).toMatch(/structure/i);
    expect(validateStep(0, { entityType: 'sole-trader', associates: 'no' }).errors).toEqual([]);
    expect(validateStep(1, { ...soleTrader, givenName: '', dateOfBirth: '2999-01-01' }).errors.join(' ')).toMatch(/given name/i);
    expect(validateStep(1, { ...soleTrader, dateOfBirth: '1990-02-31' }).errors.join(' ')).toMatch(/date of birth/i);
    expect(validateStep(2, { ...soleTrader, activity: 'bikes' }).errors.join(' ')).toMatch(/sentence/i);
    expect(validateStep(2, soleTrader).errors).toEqual([]);
    const tfn = validateStep(2, { ...soleTrader, activity: 'TFN 123456789 for the shop' });
    expect(tfn.errors[0].toLowerCase()).toContain('tax file number');
    expect(findTfnField({ ...soleTrader, activity: 'TFN 123456789 for the shop' })).toBe('activity');
  });

  it('explains the published GST threshold without turning it into advice', () => {
    expect(GST_TURNOVER_THRESHOLD_AUD).toBe(75000);
    const under = gstGuidance({ turnover: 'under', gst: 'no' });
    const over = gstGuidance({ turnover: 'over', gst: 'yes' });
    expect(under.text).toContain('A$75,000');
    expect(under.text.toLowerCase()).toContain('not tax advice');
    expect(under.text).not.toBe(over.text);
    expect(over.text.toLowerCase()).toContain('confirm');
    expect(safeOfficialHref(under.href)).toMatch(/^https:\/\/www\.ato\.gov\.au\//);
    expect(safeOfficialHref('https://evil.example/www.ato.gov.au')).toBeUndefined();
    expect(validateStep(5, { ...soleTrader, gst: '', turnover: '' }).errors.length).toBeGreaterThan(0);
    expect(validateStep(5, soleTrader).errors).toEqual([]);
  });

  it('stores answers only in the provided storage and clears them', () => {
    const local = memoryStorage();
    const session = memoryStorage({
      'startupSavvy.guide.v1': JSON.stringify({ step: 2, answers: { givenName: 'Old', entityType: 'sole-trader', associates: 'no' } }),
    });
    const moved = readGuideState({ local, session });
    expect(moved.answers.givenName).toBe('Old');
    expect(session.dump().has('startupSavvy.guide.v1')).toBe(false);
    expect(local.dump().has('startupSavvy.guide.v1')).toBe(true);

    const blocked = writeGuideState({ local, session }, { step: 2, answers: { ...soleTrader, activity: 'TFN 123456789' } });
    expect(blocked.ok).toBe(false);
    expect(readGuideState({ local, session }).answers.activity).not.toMatch(/123456789/);

    writeGuideState({ local, session }, { step: 4, answers: soleTrader, checks: { 'copy-yourself': true, injected: true } });
    expect(readGuideState({ local, session }).checks['copy-yourself']).toBe(true);
    expect(readGuideState({ local, session }).checks.injected).toBeUndefined();
    clearGuideState({ local, session });
    expect(local.dump().size).toBe(0);
    expect(readGuideState({ local, session }).answers.givenName).toBe('');
  });

  it('does not implement email delivery', () => {
    const source = readFileSync(new URL('../src/lib/guide/email-stub.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(deliverPackByEmail({ to: 'person@example.com' })).toMatchObject({
      ok: false,
      sent: false,
      reason: 'not_implemented',
    });
  });

  it('keeps the questionnaire off the public page and on the paid pack', () => {
    const guide = renderGuide();
    expect(guide.toLowerCase()).toContain('does not collect');
    expect(guide).not.toContain('name="givenName"');
    expect(guide.toLowerCase()).toContain('this guide is for sole traders');
    const report = renderReport();
    expect(report).toContain('data-paid="true"');
    expect(report).toContain('Delete my answers');
    expect(report.toLowerCase()).toContain('not tax, legal or financial advice');
    expect(report).toContain('abr.gov.au');
    expect(report.toLowerCase()).toContain('save as pdf');
    expect(report.toLowerCase()).toContain('does not fill, submit or call');
  });
});
