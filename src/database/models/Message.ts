import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Message extends Model {
  static table = 'messages';

  static associations: Associations = {
    sender: { type: 'belongs_to', key: 'sender_id' },
    chat_session: { type: 'belongs_to', key: 'chat_session_id' },
  };

  @field('text')
  text!: string;

  @field('sender_id')
  senderId!: string;

  @field('chat_session_id')
  chatSessionId!: string;

  @field('status')
  status!: string; // 'sent', 'delivered', 'read'

  @date('timestamp')
  timestamp!: number;

  @field('reply_to_message_id')
  replyToMessageId?: string;

  @field('media_url')
  mediaUrl?: string;

  @field('media_type')
  mediaType?: string; // 'image', 'video', 'audio', 'document'

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;
}