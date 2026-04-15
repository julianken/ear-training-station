import type { DB } from './db';
import { DEFAULT_SETTINGS, type Settings } from '@/types/domain';

const KEY = 'singleton' as const;

export interface SettingsRepo {
  getOrDefault(): Promise<Settings>;
  update(partial: Partial<Settings>): Promise<void>;
}

export function createSettingsRepo(db: DB): SettingsRepo {
  return {
    async getOrDefault() {
      const existing = await db.get('settings', KEY);
      return existing ?? { ...DEFAULT_SETTINGS };
    },

    async update(partial) {
      const current = await this.getOrDefault();
      const next: Settings = { ...current, ...partial };
      await db.put('settings', next, KEY);
    },
  };
}
