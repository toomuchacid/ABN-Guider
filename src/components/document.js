import { brand } from '../config/brand.js';
import { legalNav, nav, officialLinks } from '../content/copy.js';
import { escapeHtml } from '../lib/html.js';
import { analyticsSnippet, contentSecurityPolicy } from '../lib/security-headers.js';

function navLinks(items, path) {
  return items.map((item) => {
    const current = item.href === path ? ' aria-current="page"' : '';
    return `<a href="${escapeHtml(item.href)}"${current}>${escapeHtml(item.label)}</a>`;
  }).join('');
}

function externalLinks(items) {
  return items.map((item) => (
    `<a href="${escapeHtml(item.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.label)}<span class="sr-only"> (opens in a new tab)</span></a>`
  )).join('');
}

export function renderDocument({
  title,
  description,
  path,
  main,
  scripts = [],
  noindex = false,
}) {
  const fullTitle = path === '/'
    ? `${brand.name} — private ABN application guide`
    : `${title} · ${brand.name}`;
  const scriptTags = scripts.map((src) => `<script type="module" src="${escapeHtml(src)}"></script>`).join('');
  const robots = noindex ? '<meta name="robots" content="noindex">' : '';
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#0c5c5a">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(contentSecurityPolicy())}">
  ${robots}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/site.css">
  ${analyticsSnippet()}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <div class="gov-banner">
    <p><strong>Private website — not a government website.</strong> ${escapeHtml(brand.name)} is not affiliated with the ATO, the ABR, ASIC or IP Australia.</p>
  </div>
  <header class="site-header">
    <div class="wrap header-row">
      <a class="logo" href="/">${escapeHtml(brand.name)}</a>
      <details class="menu">
        <summary><span class="open-label">Menu</span><span class="close-label">Close</span></summary>
        <nav aria-label="Primary">${navLinks(nav, path)}</nav>
      </details>
      <nav class="desk-nav" aria-label="Primary">${navLinks(nav, path)}</nav>
    </div>
  </header>
  <main id="main">
    ${main}
  </main>
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div class="footer-notice">
        <p><strong>Not a government website.</strong> ${escapeHtml(brand.name)} is a private guide operated by ${escapeHtml(brand.legalName)}. Applying for an ABN is free at the official service. We don’t lodge applications or give tax, legal or financial advice.</p>
      </div>
      <div>
        <h2>On this site</h2>
        <nav aria-label="Footer">${navLinks([...nav, ...legalNav], path)}</nav>
      </div>
      <div>
        <h2>Official sites</h2>
        <nav aria-label="Official government and agency sites">${externalLinks(officialLinks)}</nav>
      </div>
      <div>
        <h2>Contact</h2>
        <p><a href="mailto:${escapeHtml(brand.contactEmail)}">${escapeHtml(brand.contactEmail)}</a></p>
        <p>We never ask for a tax file number.</p>
      </div>
    </div>
    <div class="wrap footer-end">
      <p>© ${new Date().getFullYear()} ${escapeHtml(brand.name)}. Legal pages are drafts and need a lawyer’s review.</p>
    </div>
  </footer>
  ${scriptTags}
</body>
</html>
`;
}

export function renderBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === 'h2') return `<h2>${escapeHtml(block.text)}</h2>`;
    if (block.type === 'p') return `<p>${escapeHtml(block.text)}</p>`;
    if (block.type === 'ul') {
      return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }
    return '';
  }).join('\n');
}
