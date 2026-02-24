import { API_CONFIG } from '../config/constants';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import AuthToken from '../database/models/AuthToken';

class ApiServiceClass {
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  // 获取 Token
  async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    try {
      const collection = database.collections.get<AuthToken>('auth_tokens');
      if (!collection) {
        return { accessToken: null, refreshToken: null };
      }

      const tokens = await collection.query().fetch();

      if (tokens.length === 0) {
        console.log('[ApiService] getTokens: No tokens found');
        return { accessToken: null, refreshToken: null };
      }

      const token = tokens[0];
      console.log('[ApiService] getTokens: Found tokens, expiresAt:', new Date(token.expiresAt).toISOString());
      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
      };
    } catch (error) {
      console.error('[ApiService] Get tokens failed:', error);
      return { accessToken: null, refreshToken: null };
    }
  }

  // 保存 Token（public 方法，供 AuthContext 调用）
  async saveTokens(accessToken: string, refreshToken: string) {
    try {
      const collection = database.collections.get<AuthToken>('auth_tokens');
      if (!collection) {
        console.warn('[ApiService] saveTokens: auth_tokens collection not available');
        return;
      }

      await database.write(async () => {
        const existingTokens = await collection.query().fetch();

        if (existingTokens.length > 0) {
          // 更新现有 Token
          await existingTokens[0].update(t => {
            t.accessToken = accessToken;
            t.refreshToken = refreshToken;
            t.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 天
          });
        } else {
          // 创建新 Token
          await collection.create(t => {
            t.accessToken = accessToken;
            t.refreshToken = refreshToken;
            t.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
          });
        }
      });
      console.log('[ApiService] saveTokens: Tokens saved successfully');
    } catch (error) {
      console.error('[ApiService] Save tokens failed:', error);
    }
  }

  // 清除 Token
  async clearTokens() {
    try {
      const collection = database.collections.get<AuthToken>('auth_tokens');
      if (!collection) {
        return;
      }

      await database.write(async () => {
        const tokens = await collection.query().fetch();
        await Promise.all(tokens.map(t => t.destroyPermanently()));
      });
      console.log('[ApiService] clearTokens: Tokens cleared');
    } catch (error) {
      console.error('[ApiService] Clear tokens failed:', error);
    }
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;

    // 获取 Token
    const { accessToken, refreshToken } = await this.getTokens();
    console.log('[ApiService] request:', endpoint, 'accessToken:', accessToken ? 'exists' : 'null', 'refreshToken:', refreshToken ? 'exists' : 'null');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data: any = await response.json();

    // 处理 401 - Token 过期
    if (response.status === 401 && !(options.headers as any)?.['_retry']) {
      return this.handle401(endpoint, options) as Promise<T>;
    }

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data as T;
  }

  // 处理 Token 刷新
  private async handle401(endpoint: string, options: RequestInit): Promise<any> {
    if (this.isRefreshing) {
      return new Promise((resolve) => {
        this.refreshSubscribers.push((token: string) => {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            '_retry': 'true',
          };
          resolve(this.request(endpoint, options));
        });
      });
    }

    this.isRefreshing = true;

    try {
      const tokens = await this.getTokens();
      if (!tokens.refreshToken) throw new Error('No refresh token');

      const data: any = await this.request('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      // 保存新 Token
      await this.saveTokens(data.data.accessToken, data.data.refreshToken);

      // 通知等待的请求
      this.refreshSubscribers.forEach(cb => cb(data.data.accessToken));
      this.refreshSubscribers = [];

      // 重试原请求
      return this.request(endpoint, options);
    } catch (error) {
      // 刷新失败，清除 Token
      await this.clearTokens();
      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  // 认证 API
  async login(email: string, password: string) {
    console.log('[ApiService] login: Called with email:', email);
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(name: string, email: string, password: string) {
    console.log('[ApiService] register: Called with email:', email);
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  }

  async logout() {
    console.log('[ApiService] logout: Called');
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      await this.clearTokens();
    }
  }

  async getCurrentUser() {
    console.log('[ApiService] getCurrentUser: Called');
    return this.request('/api/auth/me');
  }

  // 聊天 API
  async getChats(page = 1, limit = 20) {
    return this.request(`/api/chats?page=${page}&limit=${limit}`);
  }

  async getMessages(chatId: string, page = 1, limit = 50) {
    return this.request(`/api/chats/${chatId}/messages?page=${page}&limit=${limit}`);
  }

  async sendMessage(chatId: string, text: string, type = 'text') {
    return this.request(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, type }),
    });
  }

  async markMessagesRead(chatId: string) {
    return this.request(`/api/chats/${chatId}/messages/read`, {
      method: 'POST',
    });
  }
}

export const ApiService = new ApiServiceClass();

// Helper function to get auth token
export const getAuthToken = async (): Promise<string | null> => {
  const tokens = await ApiService.getTokens();
  return tokens.accessToken;
};
