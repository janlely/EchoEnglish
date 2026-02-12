import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class ChatSession extends Model {
  static table = 'chat_sessions';

  static associations: Associations = {
    messages: { type: 'has_many', foreignKey: 'chat_session_id' },
    chat_participants: { type: 'has_many', foreignKey: 'chat_session_id' },
  };

  @field('name')
  name!: string;

  @field('type')
  type!: string; // 'direct' or 'group'

  @field('last_message_id')
  lastMessageId!: string;

  @field('unread_count')
  unreadCount!: number;

  @field('is_archived')
  isArchived!: boolean;

  @field('is_muted')
  isMuted!: boolean;

  @field('avatar_url')
  avatarUrl!: string;

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;

  @readonly
  @date('created_at')
  readonly createdAt!: number;

  @readonly
  @date('updated_at')
  readonly updatedAt!: number;
}