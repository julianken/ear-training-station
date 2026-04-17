import { describe, expect, it } from 'vitest';
import { createSettingsRepo } from '@/store/settings-repo';
import { openTestDB } from '../helpers/test-db';

describe('SettingsRepo — onboarded flag', () => {
  it('returns onboarded: false by default when no row exists', async () => {
    const db = await openTestDB();
    const repo = createSettingsRepo(db);
    const settings = await repo.getOrDefault();
    expect(settings.onboarded).toBe(false);
  });

  it('merges onboarded default into pre-existing rows that lack the field', async () => {
    const db = await openTestDB();
    // Simulate a row written before the field existed.
    await db.put('settings', {
      function_tooltip: true,
      auto_advance_on_hit: true,
      session_length: 30,
      reduced_motion: 'auto',
    } as never, 'singleton');

    const repo = createSettingsRepo(db);
    const settings = await repo.getOrDefault();
    expect(settings.onboarded).toBe(false);
    // existing fields preserved
    expect(settings.session_length).toBe(30);
  });

  it('round-trips onboarded: true through update()', async () => {
    const db = await openTestDB();
    const repo = createSettingsRepo(db);
    await repo.update({ onboarded: true });
    const settings = await repo.getOrDefault();
    expect(settings.onboarded).toBe(true);
  });
});
