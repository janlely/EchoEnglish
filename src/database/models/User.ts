import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';

export default class User extends Model {
  static table = 'users';

  static associations: Associations = {
    messages: { type: 'has_many', foreignKey: 'sender_id' },
    chat_participants: { type: 'has_many', foreignKey: 'user_id' },
  };

  @field('user_id')
  userId?: string;

  @field('name')
  name!: string;

  @field('email')
  email!: string;

  @field('password_hash')
  passwordHash?: string;

  @field('google_id')
  googleId?: string;

  @field('avatar_url')
  avatarUrl?: string;

  @field('local_avatar_path')
  localAvatarPath?: string;

  @field('is_online')
  isOnline?: boolean;

  @readonly
  @date('created_at')
  createdAt!: number;

  @readonly
  @date('updated_at')
  updatedAt!: number;
}