import { describe, it, expect } from 'vitest';
import { buildAttemptPersistence } from '@/round/persistence';
import type { Item } from '@/types/domain';

const baseItem: Item = {
  id: '5-C-major',
  degree: 5,
  key: { tonic: 'C', quality: 'major' },
  box: 'new',
  accuracy: { pitch: 0, label: 0 },
  recent: [],
  attempts: 0,
  consecutive_passes: 0,
  last_seen_at: null,
  due_at: 0,
  created_at: 0,
};

describe('buildAttemptPersistence', () => {
  it('promotes box from new → learning on a passing attempt', () => {
    const { updatedItem } = buildAttemptPersistence({
      item: baseItem,
      sessionId: 'sess-1',
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 1000,
      target: { hz: 392 },
      sung: { hz: 392, cents_off: 0, confidence: 0.95 },
      spoken: { digit: 5, confidence: 0.9 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'comfortable',
    });

    // new → learning on first pass
    expect(updatedItem.box).toBe('learning');
  });

  it('keeps box on new after a miss', () => {
    const { updatedItem } = buildAttemptPersistence({
      item: baseItem,
      sessionId: 'sess-1',
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 1000,
      target: { hz: 392 },
      sung: { hz: 300, cents_off: 150, confidence: 0.5 },
      spoken: { digit: 3, confidence: 0.7 },
      pitchOk: false,
      labelOk: false,
      timbre: 'piano',
      register: 'comfortable',
    });

    // new → new on miss (nextBoxOnMiss('new') = 'new')
    expect(updatedItem.box).toBe('new');
  });

  it('increments attempts and recomputes accuracy on pass', () => {
    const { updatedItem } = buildAttemptPersistence({
      item: baseItem,
      sessionId: 'sess-1',
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 1000,
      target: { hz: 392 },
      sung: { hz: 392, cents_off: 0, confidence: 0.95 },
      spoken: { digit: 5, confidence: 0.9 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'comfortable',
    });

    expect(updatedItem.attempts).toBe(1);
    // pitch accuracy: one pass in window of size 1 → 1.0
    expect(updatedItem.accuracy.pitch).toBe(1);
    expect(updatedItem.accuracy.label).toBe(1);
  });

  it('resets consecutive_passes to 0 on miss, increments on pass', () => {
    const itemWith2Passes: Item = { ...baseItem, consecutive_passes: 2 };

    const { updatedItem: afterPass } = buildAttemptPersistence({
      item: itemWith2Passes,
      sessionId: 'sess-1',
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 1000,
      target: { hz: 392 },
      sung: { hz: 392, cents_off: 0, confidence: 0.95 },
      spoken: { digit: 5, confidence: 0.9 },
      pitchOk: true,
      labelOk: true,
      timbre: 'piano',
      register: 'comfortable',
    });
    expect(afterPass.consecutive_passes).toBe(3);

    const { updatedItem: afterMiss } = buildAttemptPersistence({
      item: itemWith2Passes,
      sessionId: 'sess-1',
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 1000,
      target: { hz: 392 },
      sung: { hz: 300, cents_off: 150, confidence: 0.5 },
      spoken: { digit: 3, confidence: 0.7 },
      pitchOk: false,
      labelOk: false,
      timbre: 'piano',
      register: 'comfortable',
    });
    expect(afterMiss.consecutive_passes).toBe(0);
  });

  it('builds attempt with correct id and shape', () => {
    const { attempt } = buildAttemptPersistence({
      item: baseItem,
      sessionId: 'sess-42',
      roundIndex: 7,
      reviewsInCurrentBox: 0,
      now: 5000,
      target: { hz: 392 },
      sung: { hz: 392, cents_off: 0, confidence: 0.95 },
      spoken: { digit: 5, confidence: 0.9 },
      pitchOk: true,
      labelOk: true,
      timbre: 'guitar',
      register: 'narrow',
    });

    expect(attempt.id).toBe('sess-42-7-5-C-major');
    expect(attempt.item_id).toBe('5-C-major');
    expect(attempt.session_id).toBe('sess-42');
    expect(attempt.at).toBe(5000);
    expect(attempt.target).toEqual({ hz: 392, degree: 5 });
    expect(attempt.timbre).toBe('guitar');
    expect(attempt.register).toBe('narrow');
    expect(attempt.graded.pass).toBe(true);
    expect(attempt.graded.at).toBe(5000);
  });

  it('attempt graded fields reflect pitchOk / labelOk inputs', () => {
    const { attempt } = buildAttemptPersistence({
      item: baseItem,
      sessionId: 'sess-1',
      roundIndex: 0,
      reviewsInCurrentBox: 0,
      now: 2000,
      target: { hz: 392 },
      sung: { hz: 300, cents_off: 90, confidence: 0.6 },
      spoken: { digit: 3, confidence: 0.7 },
      pitchOk: false,
      labelOk: true,
      timbre: 'piano',
      register: 'comfortable',
    });

    expect(attempt.graded.pitch).toBe(false);
    expect(attempt.graded.label).toBe(true);
    expect(attempt.graded.pass).toBe(false); // pitch failed → overall fail
    expect(attempt.graded.at).toBe(2000);
  });

  it('due_at advances when box stays the same (reviewsInCurrentBox increments)', () => {
    // item already in 'learning' box with several previous reviews
    const learningItem: Item = {
      ...baseItem,
      box: 'learning',
      consecutive_passes: 0,
    };
    // Miss → stays in learning; reviewsInCurrentBox = 2
    const { updatedItem } = buildAttemptPersistence({
      item: learningItem,
      sessionId: 'sess-1',
      roundIndex: 0,
      reviewsInCurrentBox: 2,
      now: 1000,
      target: { hz: 392 },
      sung: { hz: 300, cents_off: 150, confidence: 0.3 },
      spoken: { digit: 3, confidence: 0.4 },
      pitchOk: false,
      labelOk: false,
      timbre: 'piano',
      register: 'comfortable',
    });

    // due_at should be > now (learning box always has a positive interval)
    expect(updatedItem.due_at).toBeGreaterThan(1000);
  });
});
