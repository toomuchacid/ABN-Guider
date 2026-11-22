import { renderDocument } from '../components/document.js';

export function renderNameCheck() {
  const main = `
    <section class="page-head">
      <div class="wrap prose">
        <p class="todo" role="note"><strong>Not a live register search.</strong> This page does not check ABN Lookup, DNS, trade marks or ASIC, and it will not show a green light. The traffic lights are in the paid application pack.</p>
        <h1>Name check</h1>
        <p>Type a proposed business name. We’ll keep it on this device and, after you unlock the pack, check it there. On this page you only get links to the official searches.</p>
        <p>In the pack, amber means look closer or the check is not a clearance. Red means an exact ABN name match. Grey means a check failed. Grey and amber are never a green light.</p>
      </div>
    </section>
    <section>
      <div class="wrap check-layout">
        <form id="name-check-form" class="panel">
          <label for="business-name">Proposed business name</label>
          <input id="business-name" name="name" maxlength="180" autocomplete="off" required placeholder="e.g. Harbour & Co">
          <button class="btn btn-primary" type="submit">Save this name</button>
          <p id="name-check-error" class="form-error" hidden></p>
        </form>
        <div id="name-check-results" class="results" aria-live="polite"></div>
      </div>
    </section>`;
  return renderDocument({
    title: 'Name check',
    description: 'Save a proposed business name and open the official registers. The traffic-light check is in the paid pack, not on this page.',
    path: '/name-check',
    main,
    scripts: ['/assets/name-check.js'],
  });
}
