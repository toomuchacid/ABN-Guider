import { renderDocument } from '../components/document.js';

export function renderNameCheck() {
  const main = `
    <section class="page-head">
      <div class="wrap prose">
        <p class="todo" role="note"><strong>TODO (Phase 2):</strong> sample results only. Synergy Wholesale, IP Australia, ASIC and ABN Lookup are not connected. Nothing on this page is a live register search.</p>
        <h1>Name check</h1>
        <p>Type a proposed business name. You’ll get plain-English rows for a .com.au, .au and .com domain, an IP Australia trade mark search, and an ASIC business name search. Today those rows are a fixed sample so the screen can be tried end to end.</p>
        <p>Green means that one sample check found no exact match. Amber means something similar. Red means a match. Grey means the check failed or could not run — grey is never a clearance.</p>
      </div>
    </section>
    <section>
      <div class="wrap check-layout">
        <form id="name-check-form" class="panel">
          <label for="business-name">Proposed business name</label>
          <input id="business-name" name="name" maxlength="180" autocomplete="off" required placeholder="e.g. Harbour & Co">
          <button class="btn btn-primary" type="submit">Show sample result</button>
          <p id="name-check-error" class="form-error" hidden></p>
        </form>
        <div id="name-check-results" class="results" aria-live="polite"></div>
      </div>
    </section>`;
  return renderDocument({
    title: 'Name check',
    description: 'Sample business-name check with plain-English available, similar, taken and failed rows. Live registers are not connected yet.',
    path: '/name-check',
    main,
    scripts: ['/assets/name-check.js'],
  });
}
