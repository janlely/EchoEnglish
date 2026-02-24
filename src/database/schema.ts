import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 8,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'user_id', type: 'string', isOptional: true }, // 后端用户 ID
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string', isOptional: true },
        { name: 'password_hash', type: 'string', isOptional: true },
        { name: 'google_id', type: 'string', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'is_online', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'chat_sessions',
      columns: [
        { name: 'target_id', type: 'string' }, // 对方用户 ID 或群 ID
        { name: 'chat_type', type: 'string' }, // 'direct' | 'group'
        { name: 'name', type: 'string' },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'last_message_id', type: 'string', isOptional: true }, // 最新消息的 msgId（用于排序）
        { name: 'last_message_text', type: 'string', isOptional: true },
        { name: 'last_message_time', type: 'number', isOptional: true }, // 时间戳
        { name: 'unread_count', type: 'number', isOptional: true },
        { name: 'is_online', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'text', type: 'string' },
        { name: 'sender_id', type: 'string' },
        { name: 'chat_session_id', type: 'string' }, // 保留用于兼容
        { name: 'chat_type', type: 'string' }, // 'direct' | 'group'
        { name: 'target_id', type: 'string' }, // 私聊：对方用户 ID，群聊：群 ID
        { name: 'status', type: 'string' }, // 'sending', 'sent', 'delivered', 'read'
        { name: 'msg_id', type: 'string', isOptional: true }, // 前端生成的消息 ID
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
    tableSchema({
      name: 'auth_tokens',
      columns: [
        { name: 'access_token', type: 'string' },
        { name: 'refresh_token', type: 'string' },
        { name: 'expires_at', type: 'number' },
      ],
    }),
  ],
});