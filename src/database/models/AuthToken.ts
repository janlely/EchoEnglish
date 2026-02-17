import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class AuthToken extends Model {
  static table = 'auth_tokens';

  @field('access_token')
  accessToken!: string;

  @field('refresh_token')
  refreshToken!: string;

  @field('expires_at')
  expiresAt!: number;
}
