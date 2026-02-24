import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class ChatSession extends Model {
  static table = 'chat_sessions';

  static associations: Associations = {
    messages: { type: 'has_many', foreignKey: 'chat_session_id' },
  };

  @field('target_id')
  targetId!: string; // 对方用户 ID 或群 ID

  @field('chat_type')
  chatType!: string; // 'direct' | 'group'

  @field('name')
  name!: string;

  @field('avatar_url')
  avatarUrl?: string;

  @field('last_message_id')
  lastMessageId?: string; // 最新消息的 msgId（用于排序）

  @field('last_message_text')
  lastMessageText?: string;

  @field('last_message_time')
  lastMessageTime?: number; // 时间戳

  @field('unread_count')
  unreadCount?: number;

  @field('is_online')
  isOnline?: boolean;

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;
}