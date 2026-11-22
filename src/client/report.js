import { brand } from '../config/brand.js';
import { packAsText, packFromAnswers, sanitiseAnswers } from '../lib/guide/pack.js';

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
