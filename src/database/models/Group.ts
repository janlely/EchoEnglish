import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class Group extends Model {
  static table = 'groups';

  @field('group_id')
  groupId!: string;

  @field('name')
  name!: string;

  @field('avatar_url')
  avatarUrl?: string;

  @field('owner_id')
  ownerId!: string;

  @field('member_ids')
  memberIds!: string; // JSON string of member IDs

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;

  /**
   * Get member IDs as array
   */
  getMemberIds(): string[] {
    try {
      return JSON.parse(this.memberIds);
    } catch {
      return [];
    }
  }
}
