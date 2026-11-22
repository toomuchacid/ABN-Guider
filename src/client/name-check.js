import { labelForSource, toneForStatus } from '../lib/name-check/contract.js';
import { runNameCheck } from '../lib/name-check/index.js';

const form = document.querySelector('#name-check-form');
const results = document.querySelector('#name-check-results');
const error = document.querySelector('#name-check-error');

function pillText(status) {
  if (status === 'available') return 'Available';
  if (status === 'risk') return 'Similar';
  if (status === 'taken') return 'Taken';
  if (status === 'unknown') return 'Not checked';
  return 'Check failed';
}

function row(result) {
  const tone = toneForStatus(result.status);
  const item = document.createElement('li');
  item.className = `risk risk-${tone}`;
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = pillText(result.status);
  const body = document.createElement('div');
  const source = document.createElement('p');
  source.className = 'risk-source';
  source.textContent = labelForSource(result.source);
  const detail = document.createElement('p');
  detail.textContent = result.detail;
  body.append(source, detail);
  item.append(pill, body);
  return item;
}

function render(outcome) {
  results.replaceChildren();
  const summary = document.createElement('div');
  summary.className = `panel risk-${outcome.summary.tone}`;
  const title = document.createElement('h2');
  title.textContent = outcome.summary.headline;
  const detail = document.createElement('p');
  detail.textContent = outcome.summary.detail;
  summary.append(title, detail);
  const list = document.createElement('ol');
  list.className = 'risk-list';
  for (const result of outcome.results) list.append(row(result));
  results.append(summary, list);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  const name = String(new FormData(form).get('name') || '');
  const outcome = await runNameCheck(name);
  if (!outcome.ok) {
    error.hidden = false;
    error.textContent = outcome.error;
    results.replaceChildren();
    return;
  }
  render(outcome);
});
