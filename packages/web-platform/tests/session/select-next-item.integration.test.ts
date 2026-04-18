import { describe, it, expect } from 'vitest';
import { selectNextItem } from '@ear-training/core/scheduler/selection';
import type { RoundHistoryEntry } from '@ear-training/core/scheduler/interleaving';
import { buildInitialItems } from '@ear-training/core/seed/initial-items';
import { createItemsRepo } from '@/store/items-repo';
import { openTestDB } from '../helpers/test-db';

/**
 * Integration test for Plan C2 Task 5 (#113): verifies that wiring
 * `selectNextItem()` against a real IndexedDB-backed items repo delivers the
 * non-negotiable "no same-degree back-to-back" guarantee from the spec
 * (§5.2 — interleaving + Leitner SRS, no blocked practice).
 *
 * The session controller at
 *   apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.svelte.ts
 * now calls this exact pair on every `next()`:
 *   const items = await itemsRepo.listAll();
 *   selectNextItem(items, roundHistory, now, rng);
 * so verifying the pair end-to-end pins the anti-repeat contract the controller
 * relies on. Controller-level anti-repeat coverage (via `_seedRoundHistory`) lives
 * in apps/ear-training-station/src/lib/exercises/scale-degree/internal/session-controller.test.ts.
 */
describe('selectNextItem + items-repo integration — anti-repeat guarantee', () => {
  it('never returns the same item on two consecutive picks when alternatives exist', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    // Starter curriculum: 3 items (degrees 1, 3, 5 in C major) — enough
    // alternatives so same-degree back-to-back is always avoidable.
    await repo.putMany(buildInitialItems({ now: 0 }));

    const history: RoundHistoryEntry[] = [];
    // Deterministic rng so the test isn't flaky.
    const rng = () => 0.5;

    const first = selectNextItem(await repo.listAll(), history, 1_000, rng);
    expect(first).not.toBeNull();
    history.push({ itemId: first!.id, degree: first!.degree, key: first!.key });

    const second = selectNextItem(await repo.listAll(), history, 2_000, rng);
    expect(second).not.toBeNull();
    // Anti-repeat: same-degree-back-to-back is explicitly blocked by the
    // interleaving rule, so second must land on a different degree.
    expect(second!.degree).not.toBe(first!.degree);
    expect(second!.id).not.toBe(first!.id);
  });

  it('avoids same-degree repeat across 20 consecutive picks from the starter curriculum', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    await repo.putMany(buildInitialItems({ now: 0 }));

    const history: RoundHistoryEntry[] = [];
    // Use Math.random so we cover non-deterministic rng paths too.
    let now = 1_000;

    for (let round = 0; round < 20; round++) {
      const items = await repo.listAll();
      const pick = selectNextItem(items, history, now, Math.random);
      expect(pick).not.toBeNull();
      if (history.length > 0) {
        const prev = history[history.length - 1]!;
        expect(pick!.degree).not.toBe(prev.degree);
      }
      history.push({ itemId: pick!.id, degree: pick!.degree, key: pick!.key });
      now += 15_000; // 15s per round
    }
  });

  it('returns null when the only eligible item is blocked and no alternatives exist', async () => {
    const db = await openTestDB();
    const repo = createItemsRepo(db);
    // Seed only one item, then claim we just played its degree. Under the
    // scheduler's soft-fallback (drops the same-key rule but keeps the
    // same-degree rule), this single-item pool has no valid pick.
    const [only] = buildInitialItems({ now: 0 });
    await repo.put(only!);
    const history: RoundHistoryEntry[] = [
      { itemId: only!.id, degree: only!.degree, key: only!.key },
    ];

    const pick = selectNextItem(await repo.listAll(), history, 1_000, () => 0.5);
    expect(pick).toBeNull();
  });
});
