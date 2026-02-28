/**
 * Authentication Service
 * Handles user authentication operations
 */

import { ApiService } from './ApiService';
import { initDatabase, getDatabase } from '../database';
import User from '../database/models/User';
import { Q } from '@nozbe/watermelondb';

interface ApiUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface LoginResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

class AuthServiceClass {
  /**
   * Login user
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await ApiService.login(email, password);
    return data.data! as LoginResponse;
  }

  /**
   * Register new user
   */
  async register(name: string, email: string, password: string): Promise<RegisterResponse> {
    const data = await ApiService.register(name, email, password);
    return data.data! as RegisterResponse;
  }

  /**
   * Logout user
   */
  async logout(): Promise<{ success: boolean }> {
    try {
      await ApiService.logout();
      return { success: true };
    } catch (error) {
      // Always clear tokens even if logout request fails
      await ApiService.clearTokens();
      throw error;
    }
  }

  /**
   * Get current user from API
   */
  async getCurrentUser(): Promise<ApiUser | null> {
    try {
      const data = await ApiService.getCurrentUser();
      return data.data!.user as ApiUser;
    } catch (error) {
      console.log('[AuthService] Get current user failed:', error);
      return null;
    }
  }

  /**
   * Initialize database for user
   */
  async initializeDatabase(userId: string): Promise<void> {
    initDatabase(userId);
  }

  /**
   * Sync user data to local database
   */
  async syncUserToLocal(userData: ApiUser): Promise<void> {
    try {
      const db = getDatabase();
      if (!db) {
        console.log('[AuthService] Database not available');
        return;
      }

      const collection = db.collections.get<User>('users');

      // Find existing user by backend user ID
      const existingUser = await collection
        .query(Q.where('user_id', userData.id))
        .fetch()
        .then((users: User[]) => users[0] || null);

      await db.write(async () => {
        if (existingUser) {
          // Update existing user
          await existingUser.update((u: User) => {
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl ?? undefined;
          });
          console.log('[AuthService] Updated existing user:', userData.id);
        } else {
          // Create new user
          await collection.create((u: User) => {
            u.userId = userData.id;
            u.name = userData.name;
            u.email = userData.email;
            u.avatarUrl = userData.avatarUrl ?? undefined;
            u.isOnline = true;
          });
          console.log('[AuthService] Created new user:', userData.id);
        }
      });
    } catch (error) {
      console.error('[AuthService] Sync user to local error:', error);
      // Don't throw, avoid breaking user state
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await ApiService.getTokens();
    return tokens.accessToken !== null;
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await ApiService.getTokens();
    return tokens.accessToken;
  }
}

export const AuthService = new AuthServiceClass();
