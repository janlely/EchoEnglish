import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class GroupMember extends Model {
  static table = 'group_members';

  @field('group_id')
  groupId!: string;

  @field('user_id')
  userId!: string;

  @field('name')
  name!: string;

  @field('avatar_url')
  avatarUrl?: string;

  @field('role')
  role!: string; // 'owner' | 'admin' | 'member'

  @date('joined_at')
  joinedAt!: number;

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;
}
