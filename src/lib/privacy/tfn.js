/**
 * Australian TFNs are 8 or 9 digits. We never ask for one, and we refuse
 * a free-text value that is only a TFN-shaped number so a person cannot
 * drop one into a box by mistake.
 *
 * ISO dates are 8 digits once the hyphens are removed (`2026-12-01`).
 * They are not tax file numbers, and the guide collects a start date.
 */
export function looksLikeTfn(value) {
  const text = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  if (!/^[\d\s-]+$/.test(text)) return false;
  return /^\d{8,9}$/.test(text.replace(/[\s-]/g, ''));
}

export function containsTfnPhrase(value) {
  const text = String(value ?? '');
  if (looksLikeTfn(text)) return true;
  return /\b(tfn|tax\s*file\s*number)\b[\s:.-]*\d{8,9}\b/i.test(text);
}
