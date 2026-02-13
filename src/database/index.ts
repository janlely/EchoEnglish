import { Database } from '@nozbe/watermelondb';
import { adapter } from './adapters';
import { User, ChatSession, Message, ChatParticipant, UserSetting } from './models';

// Create the database instance
export const database = new Database({
  adapter,
  modelClasses: [
    User,
    ChatSession,
    Message,
    ChatParticipant,
    UserSetting,
  ],
});

// Export types for convenience
export type { User, ChatSession, Message, ChatParticipant, UserSetting };