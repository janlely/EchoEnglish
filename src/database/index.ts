import { Database } from '@nozbe/watermelondb';
import { adapter, setUserDbName, createAdapter } from './adapters';
import { User, ChatSession, Message, ChatParticipant, UserSetting, AuthToken } from './models';

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
      ChatSession,
      Message,
      ChatParticipant,
      UserSetting,
      AuthToken,
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
export const database = new Database({
  adapter,
  modelClasses: [
    User,
    ChatSession,
    Message,
    ChatParticipant,
    UserSetting,
    AuthToken,
  ],
});

// Export types for convenience
export type { User, ChatSession, Message, ChatParticipant, UserSetting, AuthToken };