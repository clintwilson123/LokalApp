// Batching, concurrency and cancellation for the AI applicant scan.
//
// The scan used to be a serial `for` loop with `await` inside it: one
// applicant at a time, so n applicants meant n Gemini round trips laid end to
// end (0.4-1.1s each — 10-30s of spinner for a 25-person shortlist). On top of
// that, every iteration did `ranked.sort()` plus a fresh array into state: a
// full re-sort and a re-render of the entire card grid, n times, while the
// loading overlay was covering the grid the whole time. Nobody could see any
// of those intermediate orderings; they were pure cost.
//
// This module does the work concurrently in a fixed pool of lanes, hands back
// results in input order, and leaves committing to React state to the caller —
// which is what makes "one sort, one render at the end" possible.

import { computeSkillMatch } from "./skillMatch";
import { loadSkillCatalog } from "./skillCatalog";

/**
 * In-flight Gemini calls per scan. 4 keeps the round trips overlapping without
 * hammering the quota, the edge function, or the browser's connection pool.
 */
export const DEFAULT_CONCURRENCY = 4;

/** How many applicants the Quick Scan option spends quota on. */
export const QUICK_SCAN_COUNT = 5;

/**
 * Map `worker` over `items` with at most `concurrency` running at once.
 *
 * - Results are index-aligned with `items` (completion order does not leak
 *   into the output — lanes finish out of order, `results[i]` stays `i`'s).
 * - `onResult(result, index, completed, total)` fires as each finishes; that
 *   is what drives a progress counter that actually moves during the scan.
 * - `isCancelled()` is checked before an item is picked up, so cancelling
 *   stops new work from being *started* instead of merely hiding results that
 *   are already on their way.
 *
 * Resolves with the results array even when cancelled: the caller decides
 * whether a partial run is worth showing.
 */
export async function runInParallel(items, worker, options = {}) {
  const { concurrency = DEFAULT_CONCURRENCY, onResult, isCancelled } = options;
  const list = items || [];
  const results = new Array(list.length);

  const cancelled = () => (isCancelled ? Boolean(isCancelled()) : false);

  let next = 0;
  let completed = 0;

  const lane = async () => {
    for (;;) {
      if (cancelled()) return;
      const index = next;
      next += 1;
      if (index >= list.length) return;

      results[index] = await worker(list[index], index);

      completed += 1;
      // A scan that was cancelled mid-flight must not poke React state — the
      // job it was rendering has already changed.
      if (!cancelled()) onResult?.(results[index], index, completed, list.length);
    }
  };

  // Never more lanes than work: an empty roster resolves immediately instead
  // of spinning up four idle promises.
  const laneCount = Math.min(Math.max(concurrency, 1), Math.max(list.length, 1));
  await Promise.all(Array.from({ length: laneCount }, lane));

  return results;
}

/**
 * Who should the Quick Scan spend quota on?
 *
 * Pre-ranks the whole roster with the LOCAL matcher — pure, in-memory, well
 * under a millisecond for any realistic shortlist — and keeps the best
 * `count`. The AI is then asked about the candidates most likely to match,
 * instead of burning a call on someone whose skills have no overlap with the
 * job at all. If the roster already fits in `count`, it is returned untouched.
 *
 * Ties keep roster order: `Array.prototype.sort` is stable, and the roster is
 * already in application order.
 */
export async function selectQuickScan(profiles, requirements, count = QUICK_SCAN_COUNT) {
  const list = profiles || [];
  if (list.length <= count) return list;

  const { aliasIndex } = await loadSkillCatalog();
  return list
    .map((person) => ({
      person,
      score: computeSkillMatch(person.skills, requirements, aliasIndex).score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((entry) => entry.person);
}
