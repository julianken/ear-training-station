import type { DB } from './db';
import { DEFAULT_SETTINGS } from '@ear-training/core/types/domain';
import type { Settings } from '@ear-training/core/types/domain';
import type { SettingsRepo as _SettingsRepo } from '@ear-training/core/repos/interfaces';

export type { SettingsRepo } from '@ear-training/core/repos/interfaces';

const KEY = 'singleton' as const;

export function createSettingsRepo(db: DB): _SettingsRepo {
  return {
    async getOrDefault() {
      const existing = await db.get('settings', KEY);
      return { ...DEFAULT_SETTINGS, ...existing };
    },

    async update(partial: Partial<Settings>) {
      const current = await this.getOrDefault();
      const next: Settings = { ...current, ...partial };
      await db.put('settings', next, KEY);
    },
  };
}
