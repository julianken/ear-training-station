import type { Item, Register } from '@/types/domain';
import type { Degree } from '@/types/music';
import type { TimbreId } from '@/variability/pickers';

export type RoundEvent =
  | { type: 'ROUND_STARTED';   at_ms: number; item: Item; timbre: TimbreId; register: Register }
  | { type: 'CADENCE_STARTED'; at_ms: number }
  | { type: 'TARGET_STARTED';  at_ms: number }
  | { type: 'PITCH_FRAME';     at_ms: number; hz: number; confidence: number }
  | { type: 'DIGIT_HEARD';     at_ms: number; digit: Degree; confidence: number }
  | { type: 'PLAYBACK_DONE';   at_ms: number }
  | { type: 'USER_CANCELED';   at_ms: number };
