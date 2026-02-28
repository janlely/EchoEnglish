import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class UserConversation extends Model {
  static table = 'user_conversations';

  static associations: Associations = {
    user: { type: 'belongs_to', key: 'user_id' },
    conversation: { type: 'belongs_to', key: 'conversation_id' },
  };

  @field('user_id')
  userId!: string;

  @field('conversation_id')
  conversationId!: string;

  @field('last_read_msg_id')
  lastReadMsgId?: string;

  @field('unread_count')
  unreadCount?: number;

  @date('updated_at')
  updatedAt!: number;
}
