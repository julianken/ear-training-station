import { describe, it, expect } from 'vitest';
import { createOrchestrator } from '@/session/orchestrator';
import { createItemsRepo } from '@/store/items-repo';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';
import { buildInitialItems } from '@/seed/initial-items';
import { computeUnlockedGroupIds } from '@/scheduler/unlock';

function seedRng(seed: number): () => number {
  // Mulberry32 — small, deterministic PRNG for reproducible tests.
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('simulated full session', () => {
  it('runs 30 rounds with near-perfect responses and unlocks the next group', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);
    await itemsRepo.putMany(buildInitialItems({ now: 0 }));

    let clock = 1_000;
    const tick = () => { clock += 15_000; return clock; }; // 15s per round

    const orch = createOrchestrator({
      itemsRepo,
      attemptsRepo,
      sessionsRepo,
      now: () => clock,
      rng: seedRng(42),
    });

    await orch.startSession({ sessionId: 'sim-1', target_items: 30 });

    let rounds = 0;
    const passRng = seedRng(111);
    while (true) {
      const item = await orch.nextItem();
      if (!item) break;
      tick();
      // 95% pass rate
      const passing = passRng() < 0.95;
      await orch.recordAttempt({
        item,
        target: { hz: 440 },
        sung: { hz: passing ? 442 : 520, cents_off: passing ? 7 : 450, confidence: 0.9 },
        spoken: { digit: passing ? item.degree : 2, confidence: 0.9 },
        pitchOk: passing,
        labelOk: passing,
        timbre: 'piano',
        register: 'comfortable',
      });
      rounds++;
      if (rounds > 200) throw new Error('runaway loop'); // safety
    }

    expect(rounds).toBe(30);
    const summary = await orch.completeSession();
    expect(summary.completed_items).toBe(30);

    // All three starter items should have advanced at least out of "new".
    const items = await itemsRepo.listAll();
    for (const it of items) {
      expect(it.box).not.toBe('new');
      expect(it.attempts).toBeGreaterThan(0);
    }

    // The next group should be unlocked (at 95% pass, all three will be
    // in reviewing/mastered long before 30 rounds).
    const unlocked = computeUnlockedGroupIds(items);
    expect(unlocked.has('c-major-diatonic-full')).toBe(true);
  });

  it('does not unlock next group after a failure-heavy session', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);
    await itemsRepo.putMany(buildInitialItems({ now: 0 }));

    let clock = 1_000;
    const orch = createOrchestrator({
      itemsRepo,
      attemptsRepo,
      sessionsRepo,
      now: () => clock,
      rng: seedRng(7),
    });

    await orch.startSession({ sessionId: 'sim-2', target_items: 30 });

    let rounds = 0;
    const miss = seedRng(99);
    while (true) {
      const item = await orch.nextItem();
      if (!item) break;
      clock += 15_000;
      // 20% pass rate — not enough to promote
      const passing = miss() < 0.2;
      await orch.recordAttempt({
        item,
        target: { hz: 440 },
        sung: { hz: passing ? 442 : 520, cents_off: passing ? 7 : 450, confidence: 0.9 },
        spoken: { digit: passing ? item.degree : 2, confidence: 0.9 },
        pitchOk: passing,
        labelOk: passing,
        timbre: 'piano',
        register: 'comfortable',
      });
      rounds++;
      if (rounds > 200) throw new Error('runaway loop');
    }

    const items = await itemsRepo.listAll();
    const unlocked = computeUnlockedGroupIds(items);
    expect(unlocked.has('c-major-diatonic-full')).toBe(false);
  });

  it('applies interleaving constraints across the session', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);
    await itemsRepo.putMany(buildInitialItems({ now: 0 }));

    let clock = 1_000;
    const orch = createOrchestrator({
      itemsRepo,
      attemptsRepo,
      sessionsRepo,
      now: () => clock,
      rng: seedRng(13),
    });
    await orch.startSession({ sessionId: 'sim-3', target_items: 30 });

    const presented: number[] = [];
    while (true) {
      const item = await orch.nextItem();
      if (!item) break;
      presented.push(item.degree);
      clock += 15_000;
      await orch.recordAttempt({
        item,
        target: { hz: 440 },
        sung: { hz: 442, cents_off: 7, confidence: 0.9 },
        spoken: { digit: item.degree, confidence: 0.9 },
        pitchOk: true,
        labelOk: true,
        timbre: 'piano',
        register: 'comfortable',
      });
    }
    // No consecutive same degree within the first group
    for (let i = 1; i < presented.length; i++) {
      expect(presented[i]).not.toBe(presented[i - 1]);
    }
  });
});
