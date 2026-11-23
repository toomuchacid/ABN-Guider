/**
 * Optional email delivery is intentionally not implemented.
 * Do not add a mail provider, a Worker route, or a fetch here.
 * The pack stays in the browser. The owner can decide later whether
 * email belongs in the product at all.
 */
export function deliverPackByEmail() {
  return {
    ok: false,
    sent: false,
    reason: 'not_implemented',
    detail: 'Emailing this pack is not available. Nothing on this page sends your answers. Use Copy, or the browser’s print dialog and Save as PDF.',
  };
}
