/**
 * Tests for TokenStorage service
 * Tests token saving, retrieval, expiration checking, and clearing
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TokenStorage } from '../../src/services/TokenStorage';

// AsyncStorage is already mocked in jest.setup.js via moduleNameMapper
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('TokenStorage', () => {
  const TOKENS_KEY = '@echoenglish_tokens';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveTokens', () => {
    it('should save tokens with 7-day expiration', async () => {
      const accessToken = 'test_access_token';
      const refreshToken = 'test_refresh_token';
      const mockDate = new Date('2024-01-01T00:00:00Z');
      const expectedExpiresAt = mockDate.getTime() + 7 * 24 * 60 * 60 * 1000;

      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      await TokenStorage.saveTokens(accessToken, refreshToken);

      expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        TOKENS_KEY,
        JSON.stringify({
          accessToken,
          refreshToken,
          expiresAt: expectedExpiresAt,
        })
      );

      jest.restoreAllMocks();
    });

    it('should throw error when AsyncStorage fails', async () => {
      mockedAsyncStorage.setItem.mockRejectedValue(new Error('Storage error'));

      await expect(
        TokenStorage.saveTokens('access', 'refresh')
      ).rejects.toThrow('Storage error');
    });
  });

  describe('getTokens', () => {
    it('should return null when no tokens exist', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);

      const result = await TokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: null,
        refreshToken: null,
      });
    });

    it('should return tokens when valid tokens exist', async () => {
      const futureDate = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const tokens = {
        accessToken: 'valid_access',
        refreshToken: 'valid_refresh',
        expiresAt: futureDate,
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(tokens));

      const result = await TokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: 'valid_access',
        refreshToken: 'valid_refresh',
      });
    });

    it('should return null when tokens are expired', async () => {
      const pastDate = Date.now() - 1000;
      const tokens = {
        accessToken: 'expired_access',
        refreshToken: 'expired_refresh',
        expiresAt: pastDate,
      };
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(tokens));

      const result = await TokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: null,
        refreshToken: null,
      });
    });

    it('should return null when stored data is invalid JSON', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue('invalid json');

      const result = await TokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: null,
        refreshToken: null,
      });
    });

    it('should return null when AsyncStorage fails', async () => {
      mockedAsyncStorage.getItem.mockRejectedValue(new Error('Read error'));

      const result = await TokenStorage.getTokens();

      expect(result).toEqual({
        accessToken: null,
        refreshToken: null,
      });
    });
  });

  describe('clearTokens', () => {
    it('should remove tokens from storage', async () => {
      await TokenStorage.clearTokens();

      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(TOKENS_KEY);
    });

    it('should not throw error when AsyncStorage fails', async () => {
      mockedAsyncStorage.removeItem.mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(TokenStorage.clearTokens()).resolves.not.toThrow();
    });
  });

  describe('refreshTokens', () => {
    it('should save new tokens', async () => {
      jest.clearAllMocks();
      mockedAsyncStorage.setItem.mockReset();
      mockedAsyncStorage.setItem.mockResolvedValue(undefined);
      
      const newAccessToken = 'new_access';
      const newRefreshToken = 'new_refresh';

      await TokenStorage.refreshTokens(newAccessToken, newRefreshToken);

      expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
      const [key, value] = mockedAsyncStorage.setItem.mock.calls[0];
      expect(key).toBe(TOKENS_KEY);

      const parsed = JSON.parse(value);
      expect(parsed.accessToken).toBe(newAccessToken);
      expect(parsed.refreshToken).toBe(newRefreshToken);
    });
  });
});
