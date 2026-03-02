import { database } from './index';
import { schema } from './schema';

/**
 * Initialize database with schema and migrations
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    const db = database;
    if (!db) {
      console.log('[Database] Database not initialized yet');
      return;
    }

    // Check if migration is needed
    const currentVersion = db.adapter.schemaVersion;
    const targetVersion = schema.version;
    
    console.log(`[Database] Current schema version: ${currentVersion}, target: ${targetVersion}`);
    
    if (currentVersion !== targetVersion) {
      console.log(`[Database] Schema version mismatch, resetting database...`);
      // Reset database to apply new schema
      await db.adapter.unsafeResetDatabase();
      console.log('[Database] Database reset completed, new schema applied');
    }

    console.log('[Database] Database initialized');
  } catch (error) {
    console.error('[Database] Error initializing database:', error);
  }
};
