import { describe, it, expect } from 'vitest';
import { createSettingsRepo } from '@/store/settings-repo';
import { openTestDB } from '../helpers/test-db';
import { DEFAULT_SETTINGS } from '@ear-training/core/types/domain';

describe('settings-repo', () => {
  it('getOrDefault returns defaults when nothing stored', async () => {
    const db = await openTestDB();
    const repo = createSettingsRepo(db);
    const s = await repo.getOrDefault();
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('update persists changes', async () => {
    const db = await openTestDB();
    const repo = createSettingsRepo(db);
    await repo.update({ function_tooltip: false, session_length: 45 });
    const s = await repo.getOrDefault();
    expect(s.function_tooltip).toBe(false);
    expect(s.session_length).toBe(45);
    // unchanged fields retained
    expect(s.auto_advance_on_hit).toBe(DEFAULT_SETTINGS.auto_advance_on_hit);
  });
});
