import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class SyncCursor extends Model {
  static table = 'sync_cursors';

  @field('friend_cursor')
  friendCursor!: string;

  @field('group_cursor')
  groupCursor!: string;

  @field('request_cursor')
  requestCursor!: string;
}
