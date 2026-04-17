import { openEarTrainingDB, type DB } from '@ear-training/web-platform/store/db';
import { createItemsRepo } from '@ear-training/web-platform/store/items-repo';
import { createAttemptsRepo } from '@ear-training/web-platform/store/attempts-repo';
import { createSessionsRepo } from '@ear-training/web-platform/store/sessions-repo';
import { createSettingsRepo } from '@ear-training/web-platform/store/settings-repo';

let cached: Awaited<ReturnType<typeof build>> | null = null;

async function build() {
  const db: DB = await openEarTrainingDB();
  return {
    db,
    items: createItemsRepo(db),
    attempts: createAttemptsRepo(db),
    sessions: createSessionsRepo(db),
    settings: createSettingsRepo(db),
  };
}

export async function getDeps() {
  if (!cached) cached = await build();
  return cached;
}
