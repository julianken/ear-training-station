import { describe, it, expect } from 'vitest';
import { roundReducer, type RoundState } from '@ear-training/core/round/state';
import type { RoundEvent } from '@ear-training/core/round/events';
import { gradeListeningState } from '@ear-training/core/round/grade-listening';
import { buildAttemptPersistence } from '@ear-training/core/round/persistence';
import type { Item, Session } from '@ear-training/core/types/domain';
import { createAttemptsRepo } from '@/store/attempts-repo';
import { createItemsRepo } from '@/store/items-repo';
import { createSessionsRepo } from '@/store/sessions-repo';
import { openTestDB } from '../helpers/test-db';
import { C_MAJOR } from '../helpers/fixtures';

/**
 * Integration test for Plan C2 Task 10 — covers the composition seam between:
 *   roundReducer → gradeListeningState → buildAttemptPersistence → IndexedDB repos
 *
 * The session controller in apps/…/session-controller.svelte.ts wires these
 * modules together inside a Svelte-reactive class. Unit tests cover each
 * module in isolation, and the controller's own integration test covers the
 * controller + IDB path. What's missing — and what this test fills — is
 * direct verification of the module seam itself: drive a round through the
 * reducer end-to-end, compute the grade, build the persistence records,
 * write them to real (fake-indexeddb) IDB, and read them back. If any
 * upstream shape changes (event payloads, grade fields, attempt/item
 * shape), this test fails independently of the Svelte layer.
 *
 * Two behaviors are verified:
 *   1. The full pipeline produces records that IDB accepts and returns
 *      unchanged on read-back (pass, miss, and two-round promotion).
 *   2. A plain-object snapshot of a `graded` RoundState can be
 *      structured-cloned without DataCloneError — this is the invariant
 *      the controller relies on when it calls `$state.snapshot(state)`
 *      at the IDB boundary (see session-controller.svelte.ts #dispatch).
 */

// Degree-5 target in C major lands on G. G4 = 392 Hz.
const TARGET_HZ = 392;

function mkItem(overrides: Partial<Item> = {}): Item {
  return {
    id: '5-C-major',
    degree: 5,
    key: C_MAJOR,
    box: 'new',
    accuracy: { pitch: 0, label: 0 },
    recent: [],
    attempts: 0,
    consecutive_passes: 0,
    last_seen_at: null,
    due_at: 0,
    created_at: 0,
    ...overrides,
  };
}

function mkSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    started_at: 1_000,
    ended_at: null,
    target_items: 30,
    completed_items: 0,
    pitch_pass_count: 0,
    label_pass_count: 0,
    ...overrides,
  };
}

/** Replay a fixed sequence of events through the reducer, starting from idle. */
function replay(events: RoundEvent[]): RoundState {
  return events.reduce<RoundState>((s, e) => roundReducer(s, e), { kind: 'idle' });
}

describe('round lifecycle → IDB composition', () => {
  it('pass path: reducer → grade → persist → IDB reads back the attempt and updated item', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);

    const item = mkItem();
    await itemsRepo.put(item);
    const session = await sessionsRepo.start({
      id: 'sess-pass',
      started_at: 1_000,
      target_items: 30,
    });

    // Drive the reducer idle → playing_cadence → playing_target → listening.
    // Confident on-target pitch frames + a correctly heard "five" put us in
    // position to grade as a pass.
    const state = replay([
      { type: 'ROUND_STARTED', at_ms: 0, item, timbre: 'piano', register: 'comfortable' },
      { type: 'CADENCE_STARTED', at_ms: 10 },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: TARGET_HZ, confidence: 0.95 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'PITCH_FRAME', at_ms: 4800, hz: TARGET_HZ, confidence: 0.92 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 5, confidence: 0.9 },
    ]);
    expect(state.kind).toBe('listening');
    if (state.kind !== 'listening') throw new Error('unreachable');

    // Grade the listening state (pure). Thresholds match the controller's.
    const grade = gradeListeningState(state, item, {
      minPitchConfidence: 0.5,
      minDigitConfidence: 0.5,
    });
    expect(grade.outcome.pitch).toBe(true);
    expect(grade.outcome.label).toBe(true);
    expect(grade.outcome.pass).toBe(true);

    // Build the persistence records (pure).
    const now = 5_500;
    const { attempt, updatedItem } = buildAttemptPersistence({
      item,
      sessionId: session.id,
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now,
      target: { hz: TARGET_HZ },
      sung: {
        hz: grade.sungBest?.hz ?? null,
        cents_off: grade.cents_off,
        confidence: grade.sungBest?.confidence ?? 0,
      },
      spoken: {
        digit: grade.spokenDigit,
        confidence: grade.spokenConfidence,
      },
      pitchOk: grade.outcome.pitch,
      labelOk: grade.outcome.label,
      timbre: 'piano',
      register: 'comfortable',
    });

    // Write through the repos (the same calls the controller makes).
    await attemptsRepo.append(attempt);
    await itemsRepo.put(updatedItem);

    // Read back and verify every field survived the IDB round-trip.
    const readItem = await itemsRepo.get(item.id);
    expect(readItem).toEqual(updatedItem);
    expect(readItem!.box).toBe('learning');
    expect(readItem!.attempts).toBe(1);
    expect(readItem!.consecutive_passes).toBe(1);
    expect(readItem!.last_seen_at).toBe(now);
    expect(readItem!.recent).toHaveLength(1);
    expect(readItem!.recent[0]!.pass).toBe(true);

    const readAttempts = await attemptsRepo.findBySession(session.id);
    expect(readAttempts).toHaveLength(1);
    expect(readAttempts[0]).toEqual(attempt);
    expect(readAttempts[0]!.item_id).toBe(item.id);
    expect(readAttempts[0]!.session_id).toBe(session.id);
    expect(readAttempts[0]!.target.degree).toBe(5);
    expect(readAttempts[0]!.graded.pass).toBe(true);
    expect(readAttempts[0]!.sung.hz).toBe(TARGET_HZ);
    expect(readAttempts[0]!.spoken.digit).toBe(5);
  });

  it('miss path: wrong pitch + wrong digit → graded fail → IDB persists fail outcome, box stays new', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);

    const item = mkItem();
    await itemsRepo.put(item);
    const session = await sessionsRepo.start({
      id: 'sess-miss',
      started_at: 1_000,
      target_items: 30,
    });

    // Off-target pitch (C4 = 261.63 Hz, degree 1 not 5) and wrong digit.
    const state = replay([
      { type: 'ROUND_STARTED', at_ms: 0, item, timbre: 'guitar', register: 'narrow' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: 261.63, confidence: 0.95 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 3, confidence: 0.88 },
    ]);
    if (state.kind !== 'listening') throw new Error('unreachable');

    const grade = gradeListeningState(state, item, {
      minPitchConfidence: 0.5,
      minDigitConfidence: 0.5,
    });
    expect(grade.outcome.pitch).toBe(false);
    expect(grade.outcome.label).toBe(false);
    expect(grade.outcome.pass).toBe(false);

    const { attempt, updatedItem } = buildAttemptPersistence({
      item,
      sessionId: session.id,
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 5_500,
      target: { hz: TARGET_HZ },
      sung: {
        hz: grade.sungBest?.hz ?? null,
        cents_off: grade.cents_off,
        confidence: grade.sungBest?.confidence ?? 0,
      },
      spoken: {
        digit: grade.spokenDigit,
        confidence: grade.spokenConfidence,
      },
      pitchOk: grade.outcome.pitch,
      labelOk: grade.outcome.label,
      timbre: 'guitar',
      register: 'narrow',
    });

    await attemptsRepo.append(attempt);
    await itemsRepo.put(updatedItem);

    const readItem = await itemsRepo.get(item.id);
    // nextBoxOnMiss('new') = 'new' — first-round miss does not demote below new.
    expect(readItem!.box).toBe('new');
    expect(readItem!.attempts).toBe(1);
    expect(readItem!.consecutive_passes).toBe(0);

    const readAttempts = await attemptsRepo.findBySession(session.id);
    expect(readAttempts).toHaveLength(1);
    expect(readAttempts[0]!.graded.pass).toBe(false);
    expect(readAttempts[0]!.spoken.digit).toBe(3);
  });

  it('two consecutive passes on the same item: persisted state survives round-to-round through IDB', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);
    const sessionsRepo = createSessionsRepo(db);

    const item = mkItem();
    await itemsRepo.put(item);
    const session = await sessionsRepo.start({
      id: 'sess-two',
      started_at: 1_000,
      target_items: 30,
    });

    // Round 1 — pass from box='new'. Post-round: box='learning', attempts=1.
    const state1 = replay([
      { type: 'ROUND_STARTED', at_ms: 0, item, timbre: 'piano', register: 'comfortable' },
      { type: 'TARGET_STARTED', at_ms: 3200 },
      { type: 'PITCH_FRAME', at_ms: 3300, hz: TARGET_HZ, confidence: 0.95 },
      { type: 'PLAYBACK_DONE', at_ms: 4700 },
      { type: 'DIGIT_HEARD', at_ms: 5000, digit: 5, confidence: 0.9 },
    ]);
    if (state1.kind !== 'listening') throw new Error('unreachable');
    const grade1 = gradeListeningState(state1, item, {
      minPitchConfidence: 0.5, minDigitConfidence: 0.5,
    });
    const persist1 = buildAttemptPersistence({
      item,
      sessionId: session.id,
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 5_500,
      target: { hz: TARGET_HZ },
      sung: { hz: grade1.sungBest!.hz, cents_off: grade1.cents_off, confidence: grade1.sungBest!.confidence },
      spoken: { digit: grade1.spokenDigit, confidence: grade1.spokenConfidence },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'comfortable',
    });
    await attemptsRepo.append(persist1.attempt);
    await itemsRepo.put(persist1.updatedItem);

    // Round 2 — read the updated item back from IDB and pass again.
    // Because box transitioned new→learning on round 1, reviewsInCurrentBox
    // resets to 0 for round 2 (the scheduler's box-entry counter).
    const itemRound2 = await itemsRepo.get(item.id);
    expect(itemRound2).toBeDefined();
    expect(itemRound2!.box).toBe('learning');
    expect(itemRound2!.attempts).toBe(1);

    const state2 = replay([
      { type: 'ROUND_STARTED', at_ms: 10_000, item: itemRound2!, timbre: 'epiano', register: 'wide' },
      { type: 'TARGET_STARTED', at_ms: 13_200 },
      { type: 'PITCH_FRAME', at_ms: 13_300, hz: TARGET_HZ, confidence: 0.96 },
      { type: 'PLAYBACK_DONE', at_ms: 14_700 },
      { type: 'DIGIT_HEARD', at_ms: 15_000, digit: 5, confidence: 0.92 },
    ]);
    if (state2.kind !== 'listening') throw new Error('unreachable');
    const grade2 = gradeListeningState(state2, itemRound2!, {
      minPitchConfidence: 0.5, minDigitConfidence: 0.5,
    });
    const persist2 = buildAttemptPersistence({
      item: itemRound2!,
      sessionId: session.id,
      roundIndex: 1,
      reviewsInCurrentBox: 0,
      now: 15_500,
      target: { hz: TARGET_HZ },
      sung: { hz: grade2.sungBest!.hz, cents_off: grade2.cents_off, confidence: grade2.sungBest!.confidence },
      spoken: { digit: grade2.spokenDigit, confidence: grade2.spokenConfidence },
      pitchOk: true,
      labelOk: true,
      timbre: 'epiano',
      register: 'wide',
    });
    await attemptsRepo.append(persist2.attempt);
    await itemsRepo.put(persist2.updatedItem);

    // Verify both attempts persisted and IDB counts advanced.
    const finalItem = await itemsRepo.get(item.id);
    expect(finalItem!.attempts).toBe(2);
    expect(finalItem!.consecutive_passes).toBe(2);
    expect(finalItem!.recent).toHaveLength(2);
    // Still in 'learning' — takes 3 consecutive passes to promote to 'reviewing'.
    expect(finalItem!.box).toBe('learning');
    expect(finalItem!.last_seen_at).toBe(15_500);

    const allAttempts = await attemptsRepo.findBySession(session.id);
    expect(allAttempts).toHaveLength(2);
    expect(allAttempts.map((a) => a.id)).toEqual([
      `${session.id}-0-${item.id}`,
      `${session.id}-1-${item.id}`,
    ]);

    const byItem = await attemptsRepo.findByItem(item.id);
    expect(byItem).toHaveLength(2);
  });
});

describe('$state.snapshot boundary: plain object is structured-cloneable', () => {
  // The controller calls `$state.snapshot(this.state)` before handing values
  // to IndexedDB. The runtime regression that motivated this check was: a
  // Svelte-reactive RoundState was being cloned by IDB and failed with
  // `DataCloneError: object could not be cloned`. The fix snapshots to a
  // plain object at the boundary.
  //
  // This test pins the invariant at the module level: a plain object with the
  // full shape of a `graded` RoundState must round-trip through structuredClone
  // and through IDB (fake-indexeddb uses the same structured-clone algorithm
  // under the hood) without error, and the readback must deep-equal the input.
  it('a plain-object graded RoundState survives structuredClone', () => {
    const snapshot: Extract<RoundState, { kind: 'graded' }> = {
      kind: 'graded',
      item: mkItem(),
      timbre: 'piano',
      register: 'comfortable',
      outcome: { pitch: true, label: true, pass: true, at: 5_500 },
      cents_off: 3,
      sungBest: { at_ms: 3_300, hz: TARGET_HZ, confidence: 0.95 },
      digitHeard: 5,
      digitConfidence: 0.9,
    };

    // structuredClone throws DataCloneError for non-clonable values (Proxies,
    // functions, etc.). A plain object with plain fields must not throw.
    const cloned = structuredClone(snapshot);
    expect(cloned).toEqual(snapshot);
    expect(cloned).not.toBe(snapshot);
    // Mutating the clone must not affect the original — proves we got a real
    // copy and not a shared reference.
    cloned.outcome.pass = false;
    expect(snapshot.outcome.pass).toBe(true);
  });

  it('an attempt built from a plain-object graded state round-trips through IDB without DataCloneError', async () => {
    const db = await openTestDB();
    const itemsRepo = createItemsRepo(db);
    const attemptsRepo = createAttemptsRepo(db);

    const item = mkItem();
    await itemsRepo.put(item);

    // Simulate what session-controller.svelte.ts #dispatch does:
    //   gradedState = $state.snapshot(this.state) as Extract<..., { kind: 'graded' }>;
    // Here we construct the plain-object shape directly.
    const gradedSnapshot: Extract<RoundState, { kind: 'graded' }> = {
      kind: 'graded',
      item,
      timbre: 'piano',
      register: 'comfortable',
      outcome: { pitch: true, label: true, pass: true, at: 5_500 },
      cents_off: 3,
      sungBest: { at_ms: 3_300, hz: TARGET_HZ, confidence: 0.95 },
      digitHeard: 5,
      digitConfidence: 0.9,
    };

    const { attempt, updatedItem } = buildAttemptPersistence({
      item: gradedSnapshot.item,
      sessionId: mkSession().id,
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 5_500,
      target: { hz: TARGET_HZ },
      sung: {
        hz: gradedSnapshot.sungBest!.hz,
        cents_off: gradedSnapshot.cents_off,
        confidence: gradedSnapshot.sungBest!.confidence,
      },
      spoken: {
        digit: gradedSnapshot.digitHeard,
        confidence: gradedSnapshot.digitConfidence,
      },
      pitchOk: gradedSnapshot.outcome.pitch,
      labelOk: gradedSnapshot.outcome.label,
      timbre: gradedSnapshot.timbre,
      register: gradedSnapshot.register,
    });

    // IDB's put() internally structured-clones. If any field were a Proxy or
    // non-clonable value, this would throw DataCloneError.
    await expect(attemptsRepo.append(attempt)).resolves.toBeUndefined();
    await expect(itemsRepo.put(updatedItem)).resolves.toBeUndefined();

    const readBack = await attemptsRepo.findBySession(mkSession().id);
    expect(readBack).toHaveLength(1);
    expect(readBack[0]).toEqual(attempt);
  });
});
