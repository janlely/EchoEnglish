/**
 * Tests for AuthService
 * Tests authentication service methods
 */

import { AuthService } from '../../src/services/AuthService';
import { ApiService } from '../../src/services/ApiService';
import { initDatabase, getDatabase } from '../../src/database';
import User from '../../src/database/models/User';
import { Q } from '@nozbe/watermelondb';

// Mock dependencies
jest.mock('../../src/services/ApiService');
jest.mock('../../src/database');
jest.mock('../../src/database/models/User');

const mockedApiService = ApiService as jest.Mocked<typeof ApiService>;
const mockedInitDatabase = initDatabase as jest.MockedFunction<typeof initDatabase>;
const mockedGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const mockLoginResponse = {
        success: true,
        data: {
          user: {
            id: '1',
            name: 'Test User',
            email: 'test@example.com',
            avatarUrl: '...',
          },
          accessToken: 'token',
          refreshToken: 'refresh',
        },
      };
      mockedApiService.login.mockResolvedValue(mockLoginResponse as any);

      const result = await AuthService.login('test@example.com', 'password');

      expect(mockedApiService.login).toHaveBeenCalledWith('test@example.com', 'password');
      expect(result).toEqual(mockLoginResponse.data);
    });

    it('should throw error on login failure', async () => {
      mockedApiService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(AuthService.login('test@example.com', 'wrong_password')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const mockRegisterResponse = {
        success: true,
        data: {
          user: {
            id: '1',
            name: 'New User',
            email: 'new@example.com',
            avatarUrl: '...',
          },
          accessToken: 'token',
          refreshToken: 'refresh',
        },
      };
      mockedApiService.register.mockResolvedValue(mockRegisterResponse as any);

      const result = await AuthService.register('New User', 'new@example.com', 'password');

      expect(mockedApiService.register).toHaveBeenCalledWith('New User', 'new@example.com', 'password');
      expect(result).toEqual(mockRegisterResponse.data);
    });

    it('should throw error on register failure', async () => {
      mockedApiService.register.mockRejectedValue(new Error('Email already exists'));

      await expect(
        AuthService.register('New User', 'existing@example.com', 'password')
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      const mockLogoutResponse = { success: true };
      mockedApiService.logout.mockResolvedValue(mockLogoutResponse as any);

      const result = await AuthService.logout();

      expect(mockedApiService.logout).toHaveBeenCalled();
      expect(result).toEqual(mockLogoutResponse);
    });

    it('should clear tokens even if logout request fails', async () => {
      mockedApiService.logout.mockRejectedValue(new Error('Network error'));

      await AuthService.logout();

      expect(ApiService.clearTokens).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should get current user successfully', async () => {
      const mockUserResponse = {
        success: true,
        data: {
          user: {
            id: '1',
            name: 'Test User',
            email: 'test@example.com',
            avatarUrl: '...',
          },
        },
      };
      mockedApiService.getCurrentUser.mockResolvedValue(mockUserResponse as any);

      const result = await AuthService.getCurrentUser();

      expect(mockedApiService.getCurrentUser).toHaveBeenCalled();
      expect(result).toEqual(mockUserResponse.data.user);
    });

    it('should return null when no token', async () => {
      mockedApiService.getCurrentUser.mockRejectedValue(new Error('No token'));

      const result = await AuthService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should return null on request failure', async () => {
      mockedApiService.getCurrentUser.mockRejectedValue(new Error('Request failed'));

      const result = await AuthService.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('initializeDatabase', () => {
    it('should initialize database for user', async () => {
      await AuthService.initializeDatabase('user_1');

      expect(mockedInitDatabase).toHaveBeenCalledWith('user_1');
    });
  });

  describe('syncUserToLocal', () => {
    it('should create new user in local database', async () => {
      const mockDb = {
        collections: {
          get: jest.fn().mockReturnValue({
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue([]),
            }),
            create: jest.fn().mockResolvedValue({}),
          }),
        },
        write: jest.fn((fn) => fn()),
      };
      mockedGetDatabase.mockReturnValue(mockDb as any);

      const userData = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: '...',
      };

      await AuthService.syncUserToLocal(userData);

      expect(mockDb.collections.get).toHaveBeenCalledWith('users');
      expect(mockDb.write).toHaveBeenCalled();
    });

    it('should update existing user in local database', async () => {
      const mockUser = {
        update: jest.fn().mockResolvedValue({}),
      };
      const mockDb = {
        collections: {
          get: jest.fn().mockReturnValue({
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue([mockUser]),
            }),
          }),
        },
        write: jest.fn((fn) => fn()),
      };
      mockedGetDatabase.mockReturnValue(mockDb as any);

      const userData = {
        id: '1',
        name: 'Updated User',
        email: 'test@example.com',
        avatarUrl: '...',
      };

      await AuthService.syncUserToLocal(userData);

      expect(mockUser.update).toHaveBeenCalled();
    });

    it('should handle database not available', async () => {
      mockedGetDatabase.mockReturnValue(null);

      const userData = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        avatarUrl: '...',
      };

      // Should not throw
      await expect(AuthService.syncUserToLocal(userData)).resolves.not.toThrow();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', async () => {
      mockedApiService.getTokens.mockResolvedValue({
        accessToken: 'valid_token',
        refreshToken: 'valid_refresh',
      });

      const result = await AuthService.isAuthenticated();

      expect(result).toBe(true);
    });

    it('should return false when no token', async () => {
      mockedApiService.getTokens.mockResolvedValue({
        accessToken: null,
        refreshToken: null,
      });

      const result = await AuthService.isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('should return access token', async () => {
      mockedApiService.getTokens.mockResolvedValue({
        accessToken: 'valid_token',
        refreshToken: 'valid_refresh',
      });

      const result = await AuthService.getAccessToken();

      expect(result).toBe('valid_token');
    });

    it('should return null when no token', async () => {
      mockedApiService.getTokens.mockResolvedValue({
        accessToken: null,
        refreshToken: null,
      });

      const result = await AuthService.getAccessToken();

      expect(result).toBeNull();
    });
  });
});
