import { brand } from '../../config/brand.js';
import { findTfnField, sanitiseAnswers } from './pack.js';
import { STEP_COUNT, sanitiseChecks } from './questions.js';

export function emptyGuideState() {
  return { step: 0, answers: sanitiseAnswers(null), checks: sanitiseChecks(null) };
}

function parseRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const step = Number(raw.step);
  return {
    step: Number.isInteger(step) ? Math.min(Math.max(step, 0), STEP_COUNT - 1) : 0,
    answers: sanitiseAnswers(raw.answers),
    checks: sanitiseChecks(raw.checks),
  };
}

function readStore(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    return parseRecord(JSON.parse(storage.getItem(key) || 'null'));
  } catch {
    return null;
  }
}

/**
 * Answers live in localStorage. A leftover sessionStorage copy is moved
 * across once, then removed. Nothing is sent to the server.
 */
export function readGuideState(stores, key = brand.storageKey) {
  const local = readStore(stores?.local, key);
  if (local) return local;
  const session = readStore(stores?.session, key);
  if (!session) return emptyGuideState();
  writeGuideState(stores, { ...session, step: session.step }, key);
  try {
    stores?.session?.removeItem(key);
  } catch {
    /* the local copy is the one that matters */
  }
  return session;
}

export function writeGuideState(stores, state, key = brand.storageKey) {
  const answers = sanitiseAnswers(state?.answers);
  if (findTfnField(answers)) return { ok: false, error: 'Remove the tax file number. We never store one.' };
  const record = {
    version: 2,
    step: Math.min(Math.max(Number(state?.step) || 0, 0), STEP_COUNT - 1),
    answers,
    checks: sanitiseChecks(state?.checks),
  };
  stores.local.setItem(key, JSON.stringify(record));
  return { ok: true, state: parseRecord(record) };
}

export function clearGuideState(stores, key = brand.storageKey) {
  try {
    stores?.local?.removeItem(key);
  } catch {
    /* already gone */
  }
  try {
    stores?.session?.removeItem(key);
  } catch {
    /* already gone */
  }
  return emptyGuideState();
}
