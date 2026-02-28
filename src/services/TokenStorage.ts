import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKENS_KEY = '@echoenglish_tokens';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

class TokenStorageService {
  /**
   * 保存 Token
   */
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    try {
      const tokens: Tokens = {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 天
      };
      await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
      console.log('[TokenStorage] Tokens saved successfully');
    } catch (error) {
      console.error('[TokenStorage] Save tokens failed:', error);
      throw error;
    }
  }

  /**
   * 获取 Token
   */
  async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    try {
      const tokensJson = await AsyncStorage.getItem(TOKENS_KEY);
      if (!tokensJson) {
        console.log('[TokenStorage] No tokens found');
        return { accessToken: null, refreshToken: null };
      }

      const tokens: Tokens = JSON.parse(tokensJson);
      
      // 检查 Token 是否过期
      if (tokens.expiresAt < Date.now()) {
        console.log('[TokenStorage] Tokens expired');
        return { accessToken: null, refreshToken: null };
      }

      console.log('[TokenStorage] Found tokens, expiresAt:', new Date(tokens.expiresAt).toISOString());
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      console.error('[TokenStorage] Get tokens failed:', error);
      return { accessToken: null, refreshToken: null };
    }
  }

  /**
   * 清除 Token
   */
  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.removeItem(TOKENS_KEY);
      console.log('[TokenStorage] Tokens cleared');
    } catch (error) {
      console.error('[TokenStorage] Clear tokens failed:', error);
    }
  }

  /**
   * 刷新 Token（更新过期时间）
   */
  async refreshTokens(accessToken: string, refreshToken: string): Promise<void> {
    return this.saveTokens(accessToken, refreshToken);
  }
}

export const TokenStorage = new TokenStorageService();
