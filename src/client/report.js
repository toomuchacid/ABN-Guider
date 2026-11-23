import { packAsText, packFromAnswers } from '../lib/guide/pack.js';
import { CHECKLIST } from '../lib/guide/questions.js';
import { clearGuideState, readGuideState, writeGuideState } from '../lib/guide/storage.js';
import { labelForSource, safeRegisterHref, toneForStatus } from '../lib/name-check/contract.js';
import { proposedNameKey } from '../lib/name-check/official-links.js';

function stores() {
  return { local: localStorage, session: sessionStorage };
}

function savedAnswers() {
  const state = readGuideState(stores());
  const hasAny = Object.values(state.answers).some(Boolean);
  return hasAny ? state.answers : null;
}

const examplePackNote = document.querySelector('#pack-note')?.textContent || '';

function refreshPack() {
  const answers = savedAnswers();
  const live = packFromAnswers(answers || {});
  for (const row of live) {
    const node = document.querySelector(`[data-field="${row.id}"]`);
    if (!node) continue;
    if (answers) {
      node.textContent = row.value;
      node.classList.remove('is-example');
    } else if (node.dataset.example) {
      node.textContent = node.dataset.example;
      node.classList.add('is-example');
    }
  }
  const note = document.querySelector('#pack-note');
  if (note) {
    note.textContent = answers
      ? 'These are the answers saved in this browser. Copy them into the official application yourself. This page does not fill the form.'
      : examplePackNote;
  }
  const riskInput = document.querySelector('#risk-name');
  if (riskInput && !riskInput.value && answers?.tradingName) riskInput.value = answers.tradingName;
  const state = readGuideState(stores());
  for (const item of CHECKLIST) {
    const box = document.querySelector(`#check-${item.id}`);
    if (box) box.checked = Boolean(state.checks[item.id]);
  }
  return live;
}

refreshPack();
window.addEventListener('guide-saved', () => refreshPack());

document.querySelector('#delete-answers-pack')?.addEventListener('click', () => {
  const note = document.querySelector('#delete-pack-note');
  const confirm = document.querySelector('#delete-answers-pack-confirm');
  if (note) note.hidden = false;
  if (confirm) {
    confirm.hidden = false;
    confirm.focus();
  }
});

document.querySelector('#delete-answers-pack-confirm')?.addEventListener('click', () => {
  clearGuideState(stores());
  window.dispatchEvent(new CustomEvent('guide-cleared'));
  refreshPack();
  const note = document.querySelector('#pack-note');
  if (note) note.textContent = 'Answers stored in this browser have been deleted. The lines below are an example, not your application.';
});

document.querySelector('#checklist')?.addEventListener('change', (event) => {
  const box = event.target;
  if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox') return;
  const state = readGuideState(stores());
  const id = box.id.replace(/^check-/, '');
  writeGuideState(stores, { ...state, checks: { ...state.checks, [id]: box.checked } });
});

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
  const liveRows = packFromAnswers(savedAnswers() || {}).map((row) => ({
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
  return savedAnswers()?.tradingName || '';
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
