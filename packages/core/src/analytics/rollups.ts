import type { Item, Session, LeitnerBox } from '@/types/domain';
import type { Degree } from '@/types/music';
import { keyId } from '@/types/music';

export function masteryByDegree(items: ReadonlyArray<Item>): Map<Degree, number> {
  const sums = new Map<Degree, { total: number; count: number }>();
  for (const it of items) {
    const entry = sums.get(it.degree) ?? { total: 0, count: 0 };
    entry.total += it.accuracy.pitch;
    entry.count += 1;
    sums.set(it.degree, entry);
  }
  const result = new Map<Degree, number>();
  for (const [deg, { total, count }] of sums) {
    result.set(deg, count > 0 ? total / count : 0);
  }
  return result;
}

export function masteryByKey(items: ReadonlyArray<Item>): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const it of items) {
    const k = keyId(it.key);
    const entry = sums.get(k) ?? { total: 0, count: 0 };
    entry.total += it.accuracy.pitch;
    entry.count += 1;
    sums.set(k, entry);
  }
  const result = new Map<string, number>();
  for (const [k, { total, count }] of sums) {
    result.set(k, count > 0 ? total / count : 0);
  }
  return result;
}

export function leitnerCounts(items: ReadonlyArray<Item>): Record<LeitnerBox, number> {
  const counts: Record<LeitnerBox, number> = { new: 0, learning: 0, reviewing: 0, mastered: 0 };
  for (const it of items) {
    counts[it.box] += 1;
  }
  return counts;
}

const DAY_MS = 86_400_000;

function dayIndex(ts: number): number {
  return Math.floor(ts / DAY_MS);
}

export function currentStreak(sessions: ReadonlyArray<Session>, now: number): number {
  if (sessions.length === 0) return 0;
  const days = new Set(sessions.map((s) => dayIndex(s.started_at)));
  const today = dayIndex(now);
  if (!days.has(today) && !days.has(today - 1)) return 0;
  let streak = 0;
  let check = days.has(today) ? today : today - 1;
  while (days.has(check)) {
    streak++;
    check--;
  }
  return streak;
}
