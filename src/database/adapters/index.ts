import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from '../schema';

// Global variable to store the user-specific database name
let userDbName = 'echoenglish';

// Set the user-specific database name
export const setUserDbName = (userId: string) => {
  // Sanitize userId to ensure it's safe for file names
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Use fixed database name with schema version for cache busting
  userDbName = `echoenglish_user_${safeUserId}_v${schema.version}`;
  console.log('[Database] Set user DB name:', userDbName, 'Schema version:', schema.version);
};

// Get the current database name
export const getUserDbName = () => userDbName;

// Create a new adapter instance for each user
export const createAdapter = () => {
  console.log('[Database] Creating adapter with schema version:', schema.version, 'dbName:', userDbName);
  return new SQLiteAdapter({
    schema,
    dbName: userDbName,
  });
};

// Default adapter (will be overridden when user logs in)
export const adapter = createAdapter();