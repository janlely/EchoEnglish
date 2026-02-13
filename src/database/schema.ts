import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'is_online', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'chat_sessions',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' }, // 'direct' or 'group'
        { name: 'last_message_id', type: 'string', isOptional: true },
        { name: 'unread_count', type: 'number', isOptional: true },
        { name: 'is_online', type: 'boolean', isOptional: true },
        { name: 'is_archived', type: 'boolean', isOptional: true },
        { name: 'is_muted', type: 'boolean', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'text', type: 'string' },
        { name: 'sender_id', type: 'string' },
        { name: 'chat_session_id', type: 'string' },
        { name: 'status', type: 'string' }, // 'sent', 'delivered', 'read'
        { name: 'timestamp', type: 'number' },
        { name: 'reply_to_message_id', type: 'string', isOptional: true },
        { name: 'media_url', type: 'string', isOptional: true },
        { name: 'media_type', type: 'string', isOptional: true }, // 'image', 'video', 'audio', 'document'
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'chat_participants',
      columns: [
        { name: 'chat_session_id', type: 'string' },
        { name: 'user_id', type: 'string' },
        { name: 'role', type: 'string', isOptional: true }, // 'admin', 'member', etc.
        { name: 'joined_at', type: 'number' },
        { name: 'left_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'user_settings',
      columns: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'string' },
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});