import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { config } from '../config';
import { UserData, TokenPayload, GoogleUserInfo } from '../types';
import logger from '../utils/logger';

class AuthService {
  /**
   * Register a new user with email and password
   */
  async register(email: string, password: string, name: string, isEmailVerified: boolean = false): Promise<UserData | {
    user: UserData;
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          id: uuidv4(),
          email,
          name,
          passwordHash,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
          settings: {
            create: {},
          },
        },
        include: {
          settings: true,
        },
      });

      // 如果邮箱已验证，更新 emailVerification 表的 userId
      if (isEmailVerified) {
        await prisma.emailVerification.updateMany({
          where: { email },
          data: { userId: user.id },
        });
      }

      logger.info(`User registered: ${email}`);

      const userData: UserData = {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl || undefined,
        isOnline: user.isOnline,
      };

      // 如果邮箱已验证，直接返回 token（自动登录）
      if (isEmailVerified) {
        const accessToken = this.generateToken(user, 'access');
        const refreshToken = this.generateToken(user, 'refresh');
        return {
          user: userData,
          accessToken,
          refreshToken,
        };
      }

      return userData;
    } catch (error: any) {
      logger.error('Register error:', error);
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<{
    user: UserData;
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check password
      if (!user.passwordHash) {
        throw new Error('Please login with Google account');
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate tokens
      const accessToken = this.generateToken(user, 'access');
      const refreshToken = this.generateToken(user, 'refresh');

      logger.info(`User logged in: ${email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl || undefined,
          isOnline: user.isOnline,
        },
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Login or register with Google account
   */
  async loginWithGoogle(googleUser: GoogleUserInfo): Promise<{
    user: UserData;
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Check if user exists with Google ID
      let user = await prisma.user.findUnique({
        where: { googleId: googleUser.id },
      });

      if (user) {
        // Update user info
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            avatarUrl: googleUser.picture || user.avatarUrl,
            lastSeenAt: new Date(),
          },
        });

        const accessToken = this.generateToken(user, 'access');
        const refreshToken = this.generateToken(user, 'refresh');

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl || undefined,
            isOnline: user.isOnline,
          },
          accessToken,
          refreshToken,
        };
      }

      // Check if user exists with email
      user = await prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (user) {
        // Link Google account to existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleUser.id,
            avatarUrl: googleUser.picture || user.avatarUrl,
            lastSeenAt: new Date(),
          },
        });

        const accessToken = this.generateToken(user, 'access');
        const refreshToken = this.generateToken(user, 'refresh');

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl || undefined,
            isOnline: user.isOnline,
          },
          accessToken,
          refreshToken,
        };
      }

      // Create new user
      user = await prisma.user.create({
        data: {
          id: uuidv4(),
          email: googleUser.email,
          name: googleUser.name || 'Google User',
          googleId: googleUser.id,
          avatarUrl: googleUser.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(googleUser.name)}&background=random`,
          settings: {
            create: {},
          },
        },
        include: {
          settings: true,
        },
      });

      const accessToken = this.generateToken(user, 'access');
      const refreshToken = this.generateToken(user, 'refresh');

      logger.info(`Google user logged in: ${googleUser.email}`);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl || undefined,
          isOnline: user.isOnline,
        },
        accessToken,
        refreshToken,
      };
    } catch (error: any) {
      logger.error('Google login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  refreshAccessToken(refreshToken: string): { accessToken: string } {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as TokenPayload;

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Generate new access token
      const accessToken = this.generateToken(
        { id: decoded.userId, email: decoded.email, name: '' } as any,
        'access'
      );

      return { accessToken };
    } catch (error: any) {
      logger.error('Refresh token error:', error);
      // 保留原始错误信息
      if (error.message === 'Invalid token type') {
        throw error;
      }
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: any, type: 'access' | 'refresh'): string {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      type,
    };

    const expiresIn =
      type === 'access'
        ? config.jwt.accessTokenExpiresIn
        : config.jwt.refreshTokenExpiresIn;

    return jwt.sign(payload, config.jwt.secret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserData | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || undefined,
      isOnline: user.isOnline,
    };
  }

  /**
   * Update user online status
   */
  async updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeenAt: isOnline ? new Date() : null,
      },
    });
  }
}

export default new AuthService();
