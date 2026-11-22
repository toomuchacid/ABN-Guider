import { safeRegisterHref } from '../lib/name-check/contract.js';
import { normaliseQuery } from '../lib/name-check/query.js';
import { officialLinkSet, proposedNameKey } from '../lib/name-check/official-links.js';

const form = document.querySelector('#name-check-form');
const results = document.querySelector('#name-check-results');
const error = document.querySelector('#name-check-error');

function renderLinks(name) {
  results.replaceChildren();
  const note = document.createElement('div');
  note.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = 'Saved on this device';
  const detail = document.createElement('p');
  detail.textContent = `“${name}” is saved in this browser. The traffic lights run in the paid pack. These links open the official searches. They are not results, and none of them is a green light.`;
  const list = document.createElement('ul');
  list.className = 'split-list';
  for (const item of officialLinkSet(name)) {
    const href = safeRegisterHref(item.href);
    if (!href) continue;
    const li = document.createElement('li');
    const heading = document.createElement('h3');
    heading.textContent = item.source;
    const paragraph = document.createElement('p');
    paragraph.textContent = item.detail;
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open the official search';
    const extra = document.createElement('span');
    extra.className = 'sr-only';
    extra.textContent = ' (opens in a new tab)';
    link.append(extra);
    li.append(heading, paragraph, link);
    list.append(li);
  }
  note.append(title, detail, list);
  results.append(note);
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  error.hidden = true;
  const name = String(new FormData(form).get('name') || '');
  const query = normaliseQuery(name);
  if (!query.ok) {
    error.hidden = false;
    error.textContent = query.error;
    results.replaceChildren();
    return;
  }
  sessionStorage.setItem(proposedNameKey, query.name);
  renderLinks(query.name);
});
