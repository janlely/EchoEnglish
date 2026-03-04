/**
 * 好友申请数据库模型
 */

import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class FriendRequest extends Model {
  static table = 'friend_requests';

  @field('request_id')
  requestId!: string;

  @field('sender_id')
  senderId!: string;

  @field('sender_name')
  senderName!: string;

  @field('sender_email')
  senderEmail!: string;

  @field('sender_avatar')
  senderAvatar?: string;

  @field('message')
  message?: string;

  @field('is_read')
  isRead!: boolean;

  @field('status')
  status!: 'pending' | 'accepted' | 'rejected';

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;
}
