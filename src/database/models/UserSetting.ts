import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class UserSetting extends Model {
  static table = 'user_settings';

  static associations: Associations = {
    user: { type: 'belongs_to', key: 'user_id' },
  };

  @field('key')
  key!: string;

  @field('value')
  value!: string;

  @field('user_id')
  userId?: string;

  @date('created_at')
  createdAt!: number;

  @date('updated_at')
  updatedAt!: number;
}