import { Q } from '@nozbe/watermelondb';
import User from '../database/models/User';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

class AuthService {
  private database: any;
  private currentUser: AuthUser | null = null;

  constructor(database: any) {
    this.database = database;
  }

  /**
   * 获取当前登录用户
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * 检查用户是否已登录
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  /**
   * 用户名密码登录
   */
  async loginWithEmail(email: string, password: string): Promise<AuthUser> {
    try {
      const users = await this.database.collections
        .get('users')
        .query(Q.where('email', email))
        .fetch();

      if (users.length === 0) {
        throw new Error('用户不存在');
      }

      const user = users[0];
      
      // 验证密码（实际项目中应该使用 bcrypt 等加密方式）
      if (user.passwordHash !== this.hashPassword(password)) {
        throw new Error('密码错误');
      }

      this.currentUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      };

      return this.currentUser;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 注册新用户
   */
  async register(email: string, password: string, name: string): Promise<AuthUser> {
    try {
      // 检查邮箱是否已存在
      const existingUsers = await this.database.collections
        .get('users')
        .query(Q.where('email', email))
        .fetch();

      if (existingUsers.length > 0) {
        throw new Error('该邮箱已被注册');
      }

      // 创建新用户
      const newUser = await this.database.write(async () => {
        return this.database.collections.get('users').create((user: any) => {
          user.name = name;
          user.email = email;
          user.passwordHash = this.hashPassword(password);
          user.avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
          user.isOnline = false;
          user.createdAt = Date.now();
          user.updatedAt = Date.now();
        });
      });

      this.currentUser = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl,
      };

      return this.currentUser;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Google 登录
   */
  async loginWithGoogle(googleUser: any): Promise<AuthUser> {
    try {
      const googleId = googleUser.id;
      const email = googleUser.email;
      const name = googleUser.name;
      const avatarUrl = googleUser.photo;

      // 查找是否已有该 Google 账号
      const existingUsers = await this.database.collections
        .get('users')
        .query(Q.where('google_id', googleId))
        .fetch();

      if (existingUsers.length > 0) {
        // 已有账号，直接登录
        const user = existingUsers[0];
        this.currentUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        };
        return this.currentUser;
      }

      // 检查邮箱是否已存在
      const emailUsers = await this.database.collections
        .get('users')
        .query(Q.where('email', email))
        .fetch();

      if (emailUsers.length > 0) {
        // 邮箱已存在，更新该账号的 Google ID
        const user = emailUsers[0];
        await this.database.write(async () => {
          await user.update((u: any) => {
            u.googleId = googleId;
            u.avatarUrl = avatarUrl || u.avatarUrl;
            u.updatedAt = Date.now();
          });
        });
        this.currentUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        };
        return this.currentUser;
      }

      // 创建新用户
      const newUser = await this.database.write(async () => {
        return this.database.collections.get('users').create((user: any) => {
          user.name = name || 'Google User';
          user.email = email;
          user.googleId = googleId;
          user.avatarUrl = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;
          user.isOnline = false;
          user.createdAt = Date.now();
          user.updatedAt = Date.now();
        });
      });

      this.currentUser = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl,
      };

      return this.currentUser;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    this.currentUser = null;
  }

  /**
   * 简单的密码哈希（实际项目中应使用 bcrypt）
   */
  private hashPassword(password: string): string {
    // 注意：这只是示例，实际项目中应使用 bcrypt 或类似的加密库
    // React Native 中可以使用 @react-native-async-storage/async-storage 配合 crypto-js
    return password + '_echo_english_salt';
  }
}

export default AuthService;
