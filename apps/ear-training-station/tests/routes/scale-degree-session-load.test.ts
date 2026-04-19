import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openEarTrainingDB, type DB } from '@ear-training/web-platform/store/db';
import { createAttemptsRepo } from '@ear-training/web-platform/store/attempts-repo';
import { createSessionsRepo } from '@ear-training/web-platform/store/sessions-repo';
import type { Attempt } from '@ear-training/core/types/domain';

/**
 * RCA #155 — REFERENCE-SHAPE CHECK for the refresh-abandon auto-complete path
 * in `+page.ts`. This is NOT a proof that the real `load()` function fires
 * the path: it does not import or invoke `load()`. It reimplements the
 * rollup shape (`ended_at`, `completed_items = attempts.length`,
 * pass-counts) against real fake-indexeddb and asserts the resulting
 * persisted `Session` row matches the probe report bit-for-bit.
 *
 * What this proves: the rollup shape used by `rollUpAbandonedSession` +
 * `sessions.complete()` produces the symptom the probe filed (`completed_items: 6`
 * with `target_items: 15` and `ended_at` set).
 *
 * What this does NOT prove: that `+page.ts:load()` actually enters the
 * refresh-abandon branch under any given navigation. The branch condition
 * (`isReload === true`) is verified by reading the code, not exercised here.
 *
 * To promote to a real integration test, `load()` would need to be imported
 * and called with mocked `params`/`url`/`fetch`/`performance` — blocked on
 * a `$app/environment` vitest alias and a `$lib/shell/deps` mock. Filed as a
 * test-hygiene follow-up.
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

describe('RCA #155 — reference-shape check for refresh-abandon rollup', () => {
  let db: DB;

  beforeEach(async () => {
    // @ts-expect-error fake-indexeddb global
    indexedDB = new IDBFactory();
    db = await openEarTrainingDB('ear-training-rca-155');
  });

  it('reimplements the +page.ts rollup shape and confirms it produces the probe-reported symptom', async () => {
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

    // 3. Reimplement (not invoke) the +page.ts refresh-abandon logic. The
    //    real branch at +page.ts:25 is gated on `isReload === true` and
    //    `session.ended_at == null`; this test only reproduces the rollup
    //    shape, assuming the branch fires.
    const session = await sessions.get('qa-session');
    const atts = await attempts.findBySession('qa-session');
    expect(atts).toHaveLength(6);
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
