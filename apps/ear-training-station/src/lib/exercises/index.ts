import * as scaleDegree from './scale-degree';

export const exercises = [scaleDegree] as const;
export type ExerciseModule = typeof exercises[number];
export type { ExerciseManifest } from './scale-degree';
