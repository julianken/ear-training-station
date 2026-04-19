import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openEarTrainingDB, type DB } from '@ear-training/web-platform/store/db';
import { createAttemptsRepo } from '@ear-training/web-platform/store/attempts-repo';
import { createSessionsRepo } from '@ear-training/web-platform/store/sessions-repo';
import type { Attempt } from '@ear-training/core/types/domain';

/**
 * RCA #155 — reproduce the exact symptom (session ends with
 * completed_items=attempts.length, ended_at set, summary renders) via the
 * REFRESH-ABANDON auto-complete path in +page.ts, not via the scheduler.
 *
 * This test does not import +page.ts directly (SvelteKit runtime),
 * but simulates the same logic against real fake-indexeddb.
 */

function mkAttempt(idx: number): Attempt {
  return {
    id: `att-${idx}`,
    session_id: 'qa-session',
    round_index: idx,
    item_id: 'x',
    ts: idx * 1000,
    target: { hz: 440 },
    sung: { hz: 440, cents_off: 0, confidence: 0.9 },
    spoken: { digit: null, confidence: 0 },
    graded: { pitch: idx % 2 === 0, label: false, pass: false, at: idx * 1000 },
    timbre: 'piano',
    register: 'comfortable',
  };
}

describe('RCA #155 — refresh-abandon auto-completes a session mid-run', () => {
  let db: DB;

  beforeEach(async () => {
    // @ts-expect-error fake-indexeddb global
    indexedDB = new IDBFactory();
    db = await openEarTrainingDB('ear-training-rca-155');
  });

  it('simulates a mid-session reload: session is auto-completed with completed_items=attempts.length', async () => {
    const sessions = createSessionsRepo(db);
    const attempts = createAttemptsRepo(db);

    // 1. Create a fresh 15-round session.
    const started = await sessions.start({
      id: 'qa-session',
      started_at: 0,
      target_items: 15,
    });
    expect(started.ended_at).toBeNull();
    expect(started.completed_items).toBe(0);

    // 2. Simulate 6 rounds persisted (the probe observed 6 attempts).
    for (let i = 0; i < 6; i++) {
      await attempts.append(mkAttempt(i));
    }

    // 3. Simulate the +page.ts refresh-abandon logic.
    const session = await sessions.get('qa-session');
    const atts = await attempts.findBySession('qa-session');
    expect(atts).toHaveLength(6);
    // Simulate `isReload === true` branch from +page.ts:25.
    if (session!.ended_at == null) {
      const rollup = {
        ended_at: Date.now(),
        completed_items: atts.length, // <-- exactly the bug shape
        pitch_pass_count: atts.filter((a) => a.graded.pitch).length,
        label_pass_count: atts.filter((a) => a.graded.label).length,
      };
      await sessions.complete(session!.id, rollup);
    }

    // 4. Observed state matches the probe report exactly.
    const final = (await sessions.get('qa-session'))!;
    expect(final.completed_items).toBe(6);
    expect(final.ended_at).not.toBeNull();
    expect(final.target_items).toBe(15);
    // This is the probe's observation: `session_length=15`, `completed=6`,
    // `ended_at=<set>`, summary renders "Done. · 6 rounds" — without any
    // scheduler-null call site firing.
  });
});
