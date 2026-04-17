import type { Degree, Key } from './music';

export type LeitnerBox = 'new' | 'learning' | 'reviewing' | 'mastered';

export type Register = 'narrow' | 'comfortable' | 'wide';

export interface Accuracy {
  /** Rolling recency-weighted accuracy in [0, 1]. */
  pitch: number;
  /** Same for digit label recognition. */
  label: number;
}

export interface Item {
  /** Stable id, e.g. "5-C-major" (see itemId). */
  id: string;
  degree: Degree;
  key: Key;
  box: LeitnerBox;
  accuracy: Accuracy;
  /** Rolling history of recent passes (for consecutive-pass math and accuracy). */
  recent: ReadonlyArray<AttemptOutcome>;
  attempts: number;
  consecutive_passes: number;
  last_seen_at: number | null;
  due_at: number;
  created_at: number;
}

export interface AttemptOutcome {
  /** Did pitch detection match the target (octave-invariant, ±50¢). */
  pitch: boolean;
  /** Did keyword-spotting match the target digit. */
  label: boolean;
  /** An item passes only when both are true. */
  pass: boolean;
  /** When this attempt was recorded. */
  at: number;
}

export interface Attempt {
  id: string;
  item_id: string;
  session_id: string;
  at: number;
  target: {
    hz: number;
    degree: Degree;
  };
  sung: {
    hz: number | null;
    cents_off: number | null;
    confidence: number;
  };
  spoken: {
    digit: Degree | null;
    confidence: number;
  };
  graded: AttemptOutcome;
  timbre: string;
  register: Register;
}

export interface Session {
  id: string;
  started_at: number;
  ended_at: number | null;
  target_items: number;
  completed_items: number;
  pitch_pass_count: number;
  label_pass_count: number;
  /** Item id highlighted on the summary as "tomorrow's focus". */
  focus_item_id: string | null;
}

export interface Settings {
  function_tooltip: boolean;
  auto_advance_on_hit: boolean;
  session_length: 20 | 30 | 45;
  reduced_motion: 'auto' | 'on' | 'off';
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  function_tooltip: true,
  auto_advance_on_hit: true,
  session_length: 30,
  reduced_motion: 'auto',
  onboarded: false,
});
