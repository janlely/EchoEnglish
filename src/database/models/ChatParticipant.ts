import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class ChatParticipant extends Model {
  static table = 'chat_participants';

  static associations: Associations = {
    chat_session: { type: 'belongs_to', key: 'chat_session_id' },
    user: { type: 'belongs_to', key: 'user_id' },
  };

  @field('chat_session_id')
  chatSessionId!: string;

  @field('user_id')
  userId!: string;

  @field('role')
  role?: string; // 'admin', 'member', etc.

  @date('joined_at')
  joinedAt!: number;

  @date('left_at')
  leftAt?: number;

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;
}