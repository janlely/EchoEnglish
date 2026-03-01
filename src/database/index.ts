import { Database } from '@nozbe/watermelondb';
import { adapter, setUserDbName, createAdapter } from './adapters';
import {
  User,
  Conversation,
  Message,
  Friend,
  Group,
  GroupMember,
  SyncCursor,
} from './models';

let databaseInstance: Database | null = null;

// Create the database instance with user-specific file
export const initDatabase = (userId: string) => {
  console.log('[Database] Initializing database for user:', userId);

  // Set user-specific database name FIRST
  setUserDbName(userId);

  // Create a NEW adapter with the user-specific database name
  const userAdapter = createAdapter();

  // Create database with user-specific file name
  databaseInstance = new Database({
    adapter: userAdapter,
    modelClasses: [
      User,
      Conversation,
      Message,
      Friend,
      Group,
      GroupMember,
      SyncCursor,
    ],
  });

  console.log('[Database] Database initialized for user:', userId);
  return databaseInstance;
};

// Get the current database instance
export const getDatabase = (): Database | null => {
  return databaseInstance;
};

// For backward compatibility (uses default adapter)
// Note: This is a fallback database, use initDatabase() for user-specific database
export const database = new Database({
  adapter,
  modelClasses: [
    User,
    Conversation,
    Message,
    Friend,
    Group,
    GroupMember,
    SyncCursor,
  ],
});

// Export types for convenience
export type { User, Conversation, Message, Friend, Group, GroupMember, SyncCursor };