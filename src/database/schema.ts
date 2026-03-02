import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 8, // Increment version for translation field
  tables: [
    // ===== User tables =====

    // Users table - 当前登录用户信息
    tableSchema({
      name: 'users',
      columns: [
        { name: 'user_id', type: 'string' },          // 用户 ID (后端 ID)
        { name: 'name', type: 'string' },             // 用户名称
        { name: 'email', type: 'string' },            // 用户邮箱
        { name: 'password_hash', type: 'string', isOptional: true },
        { name: 'google_id', type: 'string', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },        // 远程头像 URL
        { name: 'local_avatar_path', type: 'string', isOptional: true }, // 本地头像路径
        { name: 'is_online', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // ===== Contact tables =====

    // Friends table - 好友通讯录
    tableSchema({
      name: 'friends',
      columns: [
        { name: 'friend_id', type: 'string' },      // 好友用户 ID (主键)
        { name: 'name', type: 'string' },           // 好友名称
        { name: 'email', type: 'string', isOptional: true },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'is_online', type: 'boolean', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Groups table - 群聊通讯录
    tableSchema({
      name: 'groups',
      columns: [
        { name: 'group_id', type: 'string' },       // 群 ID (主键)
        { name: 'name', type: 'string' },
        { name: 'avatar_url', type: 'string', isOptional: true },
        { name: 'owner_id', type: 'string' },
        { name: 'member_ids', type: 'string' },     // JSON 字符串，成员 ID 列表
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Group members table - 群成员详细信息
    tableSchema({
      name: 'group_members',
      columns: [
        { name: 'group_id', type: 'string' },       // 群 ID
        { name: 'user_id', type: 'string' },        // 用户 ID
        { name: 'name', type: 'string' },           // 用户名称
        { name: 'avatar_url', type: 'string', isOptional: true }, // 用户头像
        { name: 'role', type: 'string' },           // 'owner' | 'admin' | 'member'
        { name: 'joined_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Sync cursors table - 同步游标
    tableSchema({
      name: 'sync_cursors',
      columns: [
        { name: 'friend_cursor', type: 'string' },  // 好友同步游标（字符串格式的时间戳）
        { name: 'group_cursor', type: 'string' },   // 群聊同步游标
        { name: 'request_cursor', type: 'string' }, // 好友请求同步游标
      ],
    }),

    // ===== Conversation table (active contacts index) - 精简版 =====

    tableSchema({
      name: 'conversations',
      columns: [
        { name: 'conversation_id', type: 'string' },  // 主键：direct_xxx 或 group_xxx
        { name: 'type', type: 'string' },             // 'direct' | 'group'
        { name: 'target_id', type: 'string' },        // 单聊：对方 userId, 群聊：groupId
        { name: 'latest_msg_id', type: 'string', isOptional: true },
        { name: 'latest_summary', type: 'string', isOptional: true },
        { name: 'latest_sender_id', type: 'string', isOptional: true },
        { name: 'latest_timestamp', type: 'number', isOptional: true },
        { name: 'unread_count', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        // Note: name and avatar_url are removed - fetch from friends/groups tables
      ],
    }),

    // ===== Messages table =====

    tableSchema({
      name: 'messages',
      columns: [
        { name: 'conversation_id', type: 'string' },
        { name: 'text', type: 'string' },
        { name: 'translation', type: 'string', isOptional: true }, // Translation cache
        { name: 'sender_id', type: 'string' },
        { name: 'chat_session_id', type: 'string', isOptional: true }, // 保留字段用于兼容
        { name: 'chat_type', type: 'string' },       // 'direct' | 'group'
        { name: 'target_id', type: 'string', isOptional: true }, // 保留字段用于兼容
        { name: 'status', type: 'string' },
        { name: 'msg_id', type: 'string', isOptional: true },
        { name: 'timestamp', type: 'number' },
        { name: 'reply_to_message_id', type: 'string', isOptional: true },
        { name: 'media_url', type: 'string', isOptional: true },
        { name: 'media_type', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});