import { describe, it, expect, vi } from 'vitest';
import {
  runInParallel,
  selectQuickScan,
  DEFAULT_CONCURRENCY,
  QUICK_SCAN_COUNT,
} from '../lib/batchMatch';

// The applicant scan used to be a serial `for` loop with `await` inside it:
// n Gemini round trips laid end to back, plus a full re-sort and a fresh state
// commit on every single iteration. These tests pin what replaced it — a
// bounded pool of lanes, index-aligned results, and a cancellation that stops
// work from *starting* rather than merely hiding what is already in flight.

vi.mock('../lib/skillCatalog', () => ({
  loadSkillCatalog: vi.fn(async () => ({ aliasIndex: {} })),
}));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('scan constants', () => {
  it('runs four calls at a time and quick-scans five people', () => {
    // Documented in the picker UI ("run 4 at a time", "top 5"); if either
    // number changes, the copy and this expectation must move together.
    expect(DEFAULT_CONCURRENCY).toBe(4);
    expect(QUICK_SCAN_COUNT).toBe(5);
  });
});

describe('runInParallel', () => {
  it('never exceeds the concurrency cap, but really does run in parallel', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await runInParallel(
      items,
      async (n) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await wait(5);
        inFlight -= 1;
        return n;
      },
      { concurrency: 3 }
    );

    expect(peak).toBeLessThanOrEqual(3);
    // If this ever drops to 1 the loop has quietly gone serial again.
    expect(peak).toBeGreaterThan(1);
  });

  it('keeps results aligned to input order when lanes finish out of order', async () => {
    const items = [30, 10, 20, 5]; // first item is the slowest to complete

    const results = await runInParallel(
      items,
      async (ms) => {
        await wait(ms);
        return ms * 2;
      },
      { concurrency: 4 }
    );

    expect(results).toEqual([60, 20, 40, 10]);
  });

  it('reports progress once per item and ends on the total', async () => {
    const reports = [];

    await runInParallel([1, 2, 3, 4, 5], async (n) => n, {
      concurrency: 2,
      onResult: (result, index, completed, total) => reports.push({ result, index, completed, total }),
    });

    expect(reports).toHaveLength(5);
    expect(reports.map((r) => r.result).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(reports.at(-1).completed).toBe(5);
    expect(reports.every((r) => r.total === 5)).toBe(true);
    expect(reports.map((r) => r.index).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('stops picking up new work once cancelled', async () => {
    let started = 0;
    const onResult = vi.fn();

    const results = await runInParallel(
      Array.from({ length: 10 }, (_, i) => i),
      async (n) => {
        started += 1;
        return n;
      },
      { concurrency: 1, isCancelled: () => started >= 2, onResult }
    );

    // The third item is never even started, and the second result — completed
    // after the flag flipped — is not pushed into state.
    expect(started).toBe(2);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(0);
    expect(results[9]).toBeUndefined();
  });

  it('resolves immediately when there is nothing to scan', async () => {
    const worker = vi.fn();
    const onResult = vi.fn();

    const results = await runInParallel([], worker, { concurrency: 4, onResult });

    expect(results).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });
});

describe('selectQuickScan', () => {
  const requirements = ['Excel', 'Word'];

  it('returns the roster untouched when it already fits', async () => {
    const roster = [{ id: 'a', skills: 'Excel' }];

    const picked = await selectQuickScan(roster, requirements);

    expect(picked).toBe(roster);
  });

  it('takes the strongest local matches, not the first five people', async () => {
    const roster = [
      { id: 'no-overlap', skills: 'Welding' },
      { id: 'decent', skills: 'Excel' },
      { id: 'also-none', skills: 'Cooking' },
      { id: 'perfect', skills: 'Excel, Word' },
      { id: 'none-2', skills: 'Driving' },
      { id: 'none-3', skills: 'Gardening' },
    ];

    const picked = await selectQuickScan(roster, requirements, 2);

    expect(picked.map((p) => p.id)).toEqual(['perfect', 'decent']);
  });

  it('never hands back more than the scan size', async () => {
    const roster = Array.from({ length: 9 }, (_, i) => ({ id: `p${i}`, skills: 'Excel' }));

    const picked = await selectQuickScan(roster, requirements);

    expect(picked).toHaveLength(QUICK_SCAN_COUNT);
  });

  it('tolerates a roster with no skills at all', async () => {
    const roster = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}` }));

    const picked = await selectQuickScan(roster, requirements);

    expect(picked).toHaveLength(QUICK_SCAN_COUNT);
  });
});
