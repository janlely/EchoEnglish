import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Friend extends Model {
  static table = 'friends';

  @field('friend_id')
  friendId!: string;

  @field('name')
  name!: string;

  @field('email')
  email?: string;

  @field('avatar_url')
  avatarUrl?: string;

  @field('is_online')
  isOnline?: boolean;

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;
}
