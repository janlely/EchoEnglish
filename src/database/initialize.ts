import { database } from './index';
import { schema } from './schema';
import { getDatabase } from './index';

/**
 * Initialize database with schema and migrations
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Use getDatabase() to get the current user-specific database
    const db = getDatabase();
    if (!db) {
      console.log('[Database] Database not initialized yet, skipping migration check');
      return;
    }

    // WatermelonDB will automatically apply migrations when the database is opened
    // Just log the schema version for debugging
    console.log(`[Database] Database initialized with schema version ${schema.version}`);
    console.log('[Database] Database initialized');
  } catch (error) {
    console.error('[Database] Error initializing database:', error);
  }
};
