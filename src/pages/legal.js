import { legalPages } from '../content/legal.js';
import { renderBlocks, renderDocument } from '../components/document.js';

export function renderLegal(id) {
  const page = legalPages[id];
  const main = `
    <section class="page-head">
      <div class="wrap prose">
        <p class="draft" role="note">Draft for product development. This page has not been reviewed by an Australian lawyer. Do not rely on it until it has been.</p>
        <h1>${page.title}</h1>
        ${renderBlocks(page.blocks)}
      </div>
    </section>`;
  return renderDocument({
    title: page.title,
    description: page.description,
    path: `/${id === 'terms' ? 'terms' : id}`,
    main,
  });
}
