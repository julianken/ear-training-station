import { openEarTrainingDB, type DB } from '@/store/db';

/**
 * Open a fresh isolated DB for a test. Each call uses a unique name
 * so tests do not share state.
 */
let seq = 0;
export async function openTestDB(): Promise<DB> {
  seq++;
  return openEarTrainingDB(`ear-training-test-${seq}-${Math.random()}`);
}
