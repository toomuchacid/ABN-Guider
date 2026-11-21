import { describe, expect, it } from 'vitest';
import { phase2Sources } from '../src/lib/name-check/adapters.js';
import { summariseResults, toneForStatus } from '../src/lib/name-check/contract.js';
import { checkName, runNameCheck } from '../src/lib/name-check/index.js';

describe('name check contract', () => {
  it('never paints an error, unknown, or thrown adapter as green', async () => {
    expect(toneForStatus('error')).toBe('neutral');
    expect(toneForStatus('unknown')).toBe('neutral');
    expect(toneForStatus('available')).toBe('green');
    expect(toneForStatus('nope')).toBe('neutral');

    const stub = await runNameCheck('Harbour & Co');
    expect(stub.ok).toBe(true);
    expect(stub.results.some((row) => row.status === 'error')).toBe(true);
    expect(stub.results.some((row) => row.status === 'unknown')).toBe(true);
    expect(stub.summary.tone).not.toBe('green');
    expect(stub.results.find((row) => row.status === 'error').detail.toLowerCase()).toContain('not a green');

    const thrown = await checkName('Harbour', [
      { source: 'abn', async check() { throw new Error('upstream down'); } },
    ]);
    expect(thrown[0]).toMatchObject({ source: 'abn', status: 'error' });
    expect(summariseResults(thrown).tone).not.toBe('green');

    const bogus = await checkName('Harbour', [
      { source: 'abn', async check() { return { source: 'abn', status: 'availableish', detail: 'nope' }; } },
    ]);
    expect(bogus[0].status).toBe('error');
    expect(summariseResults(bogus).tone).not.toBe('green');
  });

  it('is green only when every row is available', async () => {
    const clear = await runNameCheck('Clear Name', [
      { source: 'domain:.au', async check() { return { source: 'domain:.au', status: 'available', detail: 'No exact match.' }; } },
      { source: 'business-name', async check() { return { source: 'business-name', status: 'available', detail: 'No exact match.' }; } },
    ]);
    expect(clear.summary.tone).toBe('green');

    const mixed = await runNameCheck('Mixed', [
      { source: 'domain:.au', async check() { return { source: 'domain:.au', status: 'available', detail: 'No exact match.' }; } },
      { source: 'abn', async check() { return { source: 'abn', status: 'error', detail: 'Timed out.' }; } },
    ]);
    expect(mixed.summary.tone).not.toBe('green');
    expect(mixed.summary.tone).toBe('neutral');
  });

  it('rejects a tax file number and lists the phase 2 sources', async () => {
    const blocked = await runNameCheck('123 456 789');
    expect(blocked.ok).toBe(false);
    expect(blocked.summary.tone).not.toBe('green');
    expect(phase2Sources.map((item) => item.provider)).toEqual([
      'Synergy Wholesale',
      'Synergy Wholesale',
      'Synergy Wholesale',
      'IP Australia',
      'ASIC',
      'ABN Lookup',
    ]);
  });
});
