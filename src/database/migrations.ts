import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Database migrations
// When incrementing schema version in schema.ts, add migration here
export const migrations = schemaMigrations({
  migrations: [
    // Migration from schema version 9 to 10
    // Adds is_pinned column to conversations table for pinning conversations
    {
      toVersion: 10,
      steps: [
        {
          type: 'add_columns',
          table: 'conversations',
          columns: [
            { name: 'is_pinned', type: 'boolean', isOptional: true },
          ],
        },
      ],
    },
    // Migration from schema version 8 to 9
    // Adds friend_requests table for friend request management
    {
      toVersion: 9,
      steps: [
        {
          type: 'create_table',
          schema: {
            name: 'friend_requests',
            columns: {
              request_id: { name: 'request_id', type: 'string' },
              sender_id: { name: 'sender_id', type: 'string' },
              sender_name: { name: 'sender_name', type: 'string' },
              sender_email: { name: 'sender_email', type: 'string' },
              sender_avatar: { name: 'sender_avatar', type: 'string', isOptional: true },
              message: { name: 'message', type: 'string', isOptional: true },
              is_read: { name: 'is_read', type: 'boolean' },
              status: { name: 'status', type: 'string' },
              created_at: { name: 'created_at', type: 'number' },
              updated_at: { name: 'updated_at', type: 'number' },
            },
            columnArray: [
              { name: 'request_id', type: 'string' },
              { name: 'sender_id', type: 'string' },
              { name: 'sender_name', type: 'string' },
              { name: 'sender_email', type: 'string' },
              { name: 'sender_avatar', type: 'string', isOptional: true },
              { name: 'message', type: 'string', isOptional: true },
              { name: 'is_read', type: 'boolean' },
              { name: 'status', type: 'string' },
              { name: 'created_at', type: 'number' },
              { name: 'updated_at', type: 'number' },
            ],
          },
        },
      ],
    },
  ],
});
