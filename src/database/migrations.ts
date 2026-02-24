import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // Version 8 - Add new fields to chat_sessions
    {
      toVersion: 8,
      steps: [
        {
          type: 'add_columns',
          table: 'chat_sessions',
          columns: [
            { name: 'target_id', type: 'string' },
            { name: 'chat_type', type: 'string' },
            { name: 'last_message_text', type: 'string', isOptional: true },
            { name: 'last_message_time', type: 'number', isOptional: true },
          ],
        },
        // Note: We can't rename columns in WatermelonDB migrations
        // The app code will use the new field names
        // Old fields (friend_id, type) will remain but won't be used
      ],
    },
    // Version 7 - Previous migrations
    {
      toVersion: 7,
      steps: [
        {
          type: 'add_columns',
          table: 'messages',
          columns: [
            { name: 'chat_type', type: 'string' },
            { name: 'target_id', type: 'string' },
            { name: 'msg_id', type: 'string', isOptional: true },
          ],
        },
      ],
    },
  ],
});
