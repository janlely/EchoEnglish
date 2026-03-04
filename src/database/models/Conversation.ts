import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Conversation extends Model {
  static table = 'conversations';

  @field('conversation_id')
  conversationId!: string;

  @field('type')
  type!: string; // 'direct' | 'group'

  @field('target_id')
  targetId!: string; // For direct: other userId, for group: groupId

  @field('latest_msg_id')
  latestMsgId?: string;

  @field('latest_summary')
  latestSummary?: string;

  @field('latest_sender_id')
  latestSenderId?: string;

  @field('latest_timestamp')
  latestTimestamp?: number;

  @field('unread_count')
  unreadCount?: number;

  @field('is_pinned')
  isPinned!: boolean;

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;

  /**
   * Get name from friends or groups table
   * Note: This is a helper method, actual data fetching should be done externally
   */
  async getName(): Promise<string> {
    // This is a placeholder - actual implementation should fetch from friends/groups tables
    return 'Chat';
  }

  /**
   * Get avatar from friends or groups table
   * Note: This is a helper method, actual data fetching should be done externally
   */
  async getAvatarUrl(): Promise<string | undefined> {
    // This is a placeholder - actual implementation should fetch from friends/groups tables
    return undefined;
  }
}
