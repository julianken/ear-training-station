import { describe, it, expect } from 'vitest';
import { masteryByDegree, masteryByKey, leitnerCounts, currentStreak } from '@/analytics/rollups';
import { buildInitialItems } from '@/seed/initial-items';
import type { Item, Session } from '@/types/domain';

const items = buildInitialItems({ now: 0 });

describe('masteryByDegree', () => {
  it('returns a Map with entries for degrees present in items', () => {
    const result = masteryByDegree(items);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBeGreaterThan(0);
  });

  it('computes average pitch accuracy per degree', () => {
    const tweaked: Item[] = items.map((it, i) =>
      i === 0 ? { ...it, accuracy: { pitch: 0.8, label: 0.9 } } : it,
    );
    const result = masteryByDegree(tweaked);
    expect(result.get(tweaked[0]!.degree)).toBeDefined();
  });
});

describe('masteryByKey', () => {
  it('returns a Map keyed by keyId strings', () => {
    const result = masteryByKey(items);
    expect(result).toBeInstanceOf(Map);
    for (const [k] of result) {
      expect(k).toMatch(/-/); // e.g. "C-major"
    }
  });
});

describe('leitnerCounts', () => {
  it('returns counts for all four boxes', () => {
    const result = leitnerCounts(items);
    expect(result).toHaveProperty('new');
    expect(result).toHaveProperty('learning');
    expect(result).toHaveProperty('reviewing');
    expect(result).toHaveProperty('mastered');
  });

  it('total count matches items length', () => {
    const result = leitnerCounts(items);
    const total = result.new + result.learning + result.reviewing + result.mastered;
    expect(total).toBe(items.length);
  });
});

describe('currentStreak', () => {
  const DAY = 86_400_000;

  function makeSession(startedAt: number): Session {
    return {
      id: `s-${startedAt}`,
      started_at: startedAt,
      ended_at: startedAt + 100_000,
      target_items: 10,
      completed_items: 10,
      pitch_pass_count: 8,
      label_pass_count: 9,
    };
  }

  it('returns 0 for empty sessions', () => {
    expect(currentStreak([], Date.now())).toBe(0);
  });

  it('returns 1 for a single session today', () => {
    const now = Date.now();
    expect(currentStreak([makeSession(now - 3600_000)], now)).toBe(1);
  });

  it('returns 2 for consecutive days', () => {
    const now = Date.now();
    const sessions = [
      makeSession(now - DAY - 3600_000),
      makeSession(now - 3600_000),
    ];
    expect(currentStreak(sessions, now)).toBe(2);
  });

  it('breaks streak on gap day', () => {
    const now = Date.now();
    const sessions = [
      makeSession(now - 3 * DAY),
      makeSession(now - 3600_000),
    ];
    expect(currentStreak(sessions, now)).toBe(1);
  });

  it('respects timezone offset for day boundaries', () => {
    const midnight = Math.floor(Date.now() / DAY) * DAY;
    const session1 = makeSession(midnight + 10 * 3600_000);
    const session2 = makeSession(midnight + 23.5 * 3600_000);
    const now = midnight + 24 * 3600_000;

    expect(currentStreak([session1, session2], now, 0)).toBe(1);
    expect(currentStreak([session1, session2], now, 3600_000)).toBe(2);
  });

  it('uses per-session tz_offset_ms so sessions near UTC midnight keep the streak across a DST shift', () => {
    // Bug: `currentStreak` with a single render-time offset applied to
    // all sessions can shift a session's day-index across a UTC
    // midnight, breaking a valid streak. Constructed scenario:
    //
    //   Session A  : Oct 31 20:00Z (well within "day 1 local" in any
    //                nearby zone)
    //   Session B  : Nov 1 23:45Z (just before UTC midnight — the
    //                boundary case)
    //   Now        : Nov 2 01:00Z (just after UTC midnight)
    //
    // Under the record-time offset 0 (UTC), session B's day-index is
    // Oct-31+1 = Nov 1 and today is Nov 2 → streak walks B (today-1)
    // then A = 2.
    //
    // If the VIEWER offset is +3h (e.g. the user traveled east, or the
    // renderer's zone shifted), the legacy path re-maps session B to
    // floor((Nov 1 23:45Z + 3h) / DAY) = Nov 2 — landing it on TODAY.
    // Today is Nov 2. "Yesterday" (Nov 1) has no session; session A
    // (Oct 31) is two days back. Streak collapses to 1.
    //
    // With per-session offsets stamped at creation, session B still
    // maps to Nov 1 (its recording zone), and the streak remains 2.
    const RECORD_OFFSET_MS = 0; // recorded in UTC
    const VIEWER_OFFSET_MS = 3 * 3600_000;

    const aUtc = Date.UTC(2025, 9, 31, 20, 0, 0); // Oct 31 20:00Z
    const bUtc = Date.UTC(2025, 10, 1, 23, 45, 0); // Nov 1 23:45Z
    const nowUtc = Date.UTC(2025, 10, 2, 1, 0, 0); // Nov 2 01:00Z

    const aStamped: Session = { ...makeSession(aUtc), tz_offset_ms: RECORD_OFFSET_MS };
    const bStamped: Session = { ...makeSession(bUtc), tz_offset_ms: RECORD_OFFSET_MS };
    const aLegacy = makeSession(aUtc);
    const bLegacy = makeSession(bUtc);

    // Per-session (stamped) path — answer is anchored in the recording
    // zone regardless of the viewer's render-time offset. Streak = 2.
    expect(currentStreak([aStamped, bStamped], nowUtc, VIEWER_OFFSET_MS)).toBe(2);

    // Legacy path with the same viewer offset — session B gets pulled
    // onto today (Nov 2), leaving yesterday (Nov 1) empty. Streak
    // collapses to 1. This is the exact failure mode the fix prevents.
    expect(currentStreak([aLegacy, bLegacy], nowUtc, VIEWER_OFFSET_MS)).toBe(1);

    // Sanity: with the viewer offset set to the recording offset (0),
    // the legacy path also gets 2 — the render-time offset HAPPENED
    // to match the recording offset. Per-session is invariant.
    expect(currentStreak([aLegacy, bLegacy], nowUtc, 0)).toBe(2);
    expect(currentStreak([aStamped, bStamped], nowUtc, 0)).toBe(2);
  });

  it('mixes per-session and fallback offsets within one call', () => {
    // Rollover check: if one session has a stamped offset and another
    // doesn't, the stamped one uses its own, the unstamped uses the
    // caller-provided fallback. Shows the per-session field overrides
    // the fallback without breaking legacy rows.
    const offsetA = 5 * 3600_000; // UTC+5 for session-with-stamp
    const offsetB = 0; // caller fallback
    const midnight = Math.floor(Date.now() / DAY) * DAY;

    const stamped: Session = {
      ...makeSession(midnight - DAY),
      tz_offset_ms: offsetA,
    };
    const unstamped = makeSession(midnight);
    const now = midnight + 12 * 3600_000;

    // stamped session's day with offsetA: (midnight - DAY + 5h) / DAY
    // = Math.floor → prior-day index
    // unstamped session's day with offsetB (0): midnight / DAY = today.
    // Both days should chain into a 2-day streak.
    expect(currentStreak([stamped, unstamped], now, offsetB)).toBe(2);
  });
});
