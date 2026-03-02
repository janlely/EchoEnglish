import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class Message extends Model {
  static table = 'messages';

  static associations: Associations = {
    sender: { type: 'belongs_to', key: 'sender_id' },
    chat_session: { type: 'belongs_to', key: 'chat_session_id' },
    conversation: { type: 'belongs_to', key: 'conversation_id' },
  };

  @field('text')
  text!: string;

  @field('translation')
  translation?: string; // Translation result (cached locally)

  @field('sender_id')
  senderId!: string;

  @field('chat_session_id')
  chatSessionId?: string; // 保留字段用于兼容

  @field('conversation_id')
  conversationId?: string; // 新的外键字段

  @field('chat_type')
  chatType!: string; // 'direct' | 'group'

  @field('target_id')
  targetId?: string; // 私聊：对方用户 ID，群聊：群 ID (保留用于兼容)

  @field('status')
  status!: string; // 'sending', 'sent', 'delivered', 'read'

  @field('msg_id')
  msgId?: string; // 前端生成的消息 ID，用于去重

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