import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Item, Attempt, Session, Settings } from '@ear-training/core/types/domain';

export const DB_NAME = 'ear-training';
export const DB_VERSION = 1;

export interface EarTrainingDB extends DBSchema {
  items: {
    key: string; // item.id
    value: Item;
    indexes: {
      'by-box': string;
      'by-due': number;
    };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: {
      'by-session': string;
      'by-item': string;
      'by-at': number;
    };
  };
  sessions: {
    key: string;
    value: Session;
    indexes: {
      'by-started-at': number;
    };
  };
  settings: {
    key: 'singleton';
    value: Settings;
  };
}

export type DB = IDBPDatabase<EarTrainingDB>;

export async function openEarTrainingDB(dbName: string = DB_NAME): Promise<DB> {
  return openDB<EarTrainingDB>(dbName, DB_VERSION, {
    upgrade(db) {
      const items = db.createObjectStore('items', { keyPath: 'id' });
      items.createIndex('by-box', 'box');
      items.createIndex('by-due', 'due_at');

      const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
      attempts.createIndex('by-session', 'session_id');
      attempts.createIndex('by-item', 'item_id');
      attempts.createIndex('by-at', 'at');

      const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
      sessions.createIndex('by-started-at', 'started_at');

      db.createObjectStore('settings');
    },
  });
}
