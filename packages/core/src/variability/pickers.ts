import type { Register } from '@/types/domain';

export const TIMBRE_IDS = ['piano', 'epiano', 'guitar', 'pad'] as const;
export type TimbreId = (typeof TIMBRE_IDS)[number];

const REGISTERS: readonly Register[] = ['narrow', 'comfortable', 'wide'];

export interface VariabilityHistory {
  lastTimbre: TimbreId | null;
  lastRegister: Register | null;
}

export interface VariabilitySettings {
  lockedTimbre: TimbreId | null;
  lockedRegister: Register | null;
}

export function pickTimbre(
  rng: () => number,
  history: VariabilityHistory,
  settings: VariabilitySettings,
): TimbreId {
  if (settings.lockedTimbre !== null) return settings.lockedTimbre;
  const pool = TIMBRE_IDS.filter((t) => t !== history.lastTimbre);
  return pool[Math.floor(rng() * pool.length)]!;
}

export function pickRegister(
  rng: () => number,
  history: VariabilityHistory,
  settings: VariabilitySettings,
  available: ReadonlyArray<Register> = REGISTERS,
): Register {
  if (settings.lockedRegister != null && available.includes(settings.lockedRegister)) {
    return settings.lockedRegister;
  }
  // Filter: avoid repeating the last register; fall back to available if that empties the pool
  const pool = available.filter((r) => r !== history.lastRegister);
  const chooseFrom = pool.length > 0 ? pool : available;
  return chooseFrom[Math.floor(rng() * chooseFrom.length)]!;
}
