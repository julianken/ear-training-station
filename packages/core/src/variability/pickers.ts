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
): Register {
  if (settings.lockedRegister !== null) return settings.lockedRegister;
  const pool = REGISTERS.filter((r) => r !== history.lastRegister);
  return pool[Math.floor(rng() * pool.length)]!;
}
