import { containsTfnPhrase } from '../privacy/tfn.js';

export function normaliseQuery(name) {
  if (typeof name !== 'string') return { ok: false, error: 'Enter a business name.' };
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (!trimmed) return { ok: false, error: 'Enter a business name.' };
  if (trimmed.length > 180) return { ok: false, error: 'That name is too long to check.' };
  if (/[\u0000-\u001F]/.test(trimmed)) return { ok: false, error: 'That name contains characters we can’t check.' };
  if (containsTfnPhrase(trimmed)) return { ok: false, error: 'Enter a business name, not a tax file number.' };
  return { ok: true, name: trimmed };
}
