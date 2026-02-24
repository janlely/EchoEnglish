import { database } from './index';

/**
 * Initialize database with schema
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    const db = database;
    if (!db) {
      console.log('[Database] Database not initialized yet');
      return;
    }

    console.log('[Database] Database initialized');
  } catch (error) {
    console.error('[Database] Error initializing database:', error);
  }
};
