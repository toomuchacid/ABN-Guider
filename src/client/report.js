import { brand } from '../config/brand.js';
import { packAsText, packFromAnswers, sanitiseAnswers } from '../lib/guide/pack.js';
import { labelForSource, safeRegisterHref, toneForStatus } from '../lib/name-check/contract.js';
import { proposedNameKey } from '../lib/name-check/official-links.js';

function savedAnswers() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(brand.storageKey) || 'null');
    if (!raw?.answers) return null;
    const answers = sanitiseAnswers(raw.answers);
    const hasAny = Object.values(answers).some(Boolean);
    return hasAny ? answers : null;
  } catch {
    return null;
  }
}

const answers = savedAnswers();
const rows = packFromAnswers(answers || {});
const note = document.querySelector('#pack-note');

if (answers) {
  for (const row of rows) {
    const node = document.querySelector(`[data-field="${row.id}"]`);
    if (!node) continue;
    node.textContent = row.value;
    node.classList.remove('is-example');
  }
  if (note) note.textContent = 'These are the answers saved in this browser. Copy them into the official application, which is still the source of truth.';
}

async function copyText(text, button, doneLabel) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = doneLabel;
  } catch {
    button.textContent = 'Select the text manually';
  }
  setTimeout(() => { button.textContent = original; }, 1800);
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', () => {
    const id = button.getAttribute('data-copy');
    const value = document.querySelector(`[data-field="${id}"]`)?.textContent || '';
    copyText(value, button, 'Copied');
  });
}

document.querySelector('#copy-all')?.addEventListener('click', (event) => {
  const liveRows = rows.map((row) => ({
    label: row.label,
    value: document.querySelector(`[data-field="${row.id}"]`)?.textContent || row.value,
  }));
  copyText(packAsText(liveRows), event.currentTarget, 'Copied pack');
});

const riskForm = document.querySelector('#name-risk-form');
const riskResults = document.querySelector('#name-risk-results');
const riskError = document.querySelector('#name-risk-error');
const riskInput = document.querySelector('#risk-name');

function savedProposedName() {
  const proposed = sessionStorage.getItem(proposedNameKey) || '';
  if (proposed.trim()) return proposed.trim();
  return answers?.tradingName || '';
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Australia/Sydney',
  }).format(date);
}

function pillText(result) {
  if (result.label) return result.label;
  if (result.status === 'available') return 'Available';
  if (result.status === 'risk') return 'Look closer';
  if (result.status === 'taken') return 'Match';
  if (result.status === 'unknown') return 'Not checked';
  return 'Check failed';
}

function riskRow(result) {
  const item = document.createElement('li');
  item.className = `risk risk-${toneForStatus(result.status)}`;
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = pillText(result);
  const body = document.createElement('div');
  const source = document.createElement('p');
  source.className = 'risk-source';
  source.textContent = labelForSource(result.source);
  const detail = document.createElement('p');
  detail.textContent = result.detail;
  const when = document.createElement('p');
  when.className = 'fine';
  when.textContent = `Checked ${formatWhen(result.checkedAt)} Sydney time. Source: ${labelForSource(result.source)}.`;
  body.append(source, detail, when);
  const href = safeRegisterHref(result.href);
  if (href) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open the official source';
    const extra = document.createElement('span');
    extra.className = 'sr-only';
    extra.textContent = ' (opens in a new tab)';
    link.append(extra);
    body.append(link);
  }
  item.append(pill, body);
  return item;
}

function renderRisk(outcome) {
  riskResults.replaceChildren();
  const summary = document.createElement('div');
  summary.className = `panel risk-${outcome.summary.tone}`;
  const title = document.createElement('h2');
  title.textContent = outcome.summary.headline;
  const detail = document.createElement('p');
  detail.textContent = outcome.summary.detail;
  const advice = document.createElement('p');
  advice.textContent = 'General information, not legal advice. A failed or unfinished row is not a clearance.';
  summary.append(title, detail, advice);
  const list = document.createElement('ol');
  list.className = 'risk-list';
  for (const result of outcome.results) list.append(riskRow(result));
  riskResults.append(summary, list);
}

function plainError(data, status) {
  if (status === 401) return 'The name check is part of the paid pack.';
  if (status === 429) return 'Too many checks from this pack. Try again in a little while.';
  if (typeof data?.error === 'string' && data.error.length < 200 && !/guid|secret|token/i.test(data.error)) return data.error;
  return 'The checks could not be completed. That is not a clearance.';
}

async function runRiskCheck(name) {
  riskError.hidden = true;
  const response = await fetch('/api/name-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ name }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok || !data.ok) {
    riskError.hidden = false;
    riskError.textContent = plainError(data, response.status);
    riskResults.replaceChildren();
    return;
  }
  renderRisk(data);
}

if (riskInput) {
  const initial = savedProposedName();
  if (initial) riskInput.value = initial;
}

function showRiskFailure() {
  riskError.hidden = false;
  riskError.textContent = 'The checks could not be completed. That is not a clearance.';
  riskResults.replaceChildren();
}

riskForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  runRiskCheck(String(new FormData(riskForm).get('name') || '')).catch(showRiskFailure);
});

if (riskInput?.value) runRiskCheck(riskInput.value).catch(showRiskFailure);
