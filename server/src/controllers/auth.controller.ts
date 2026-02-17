import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import authService from '../services/auth.service';
import emailVerificationService from '../services/emailVerification.service';
import logger from '../utils/logger';

class AuthController {
  /**
   * Register new user
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name } = req.body;

      // Validate input
      if (!email || !password || !name) {
        res.status(400).json({
          success: false,
          error: 'Email, password, and name are required',
        });
        return;
      }

      const user = await authService.register(email, password, name);

      // 发送邮箱验证码
      await emailVerificationService.createVerificationCode(email, user.id);

      res.status(201).json({
        success: true,
        data: { user },
        message: 'Registration successful. Please check your email for verification code.',
      });
    } catch (error: any) {
      logger.error('Register controller error:', error);
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
        return;
      }

      const result = await authService.login(email, password);

      // 检查邮箱验证状态
      const isVerified = await emailVerificationService.isEmailVerified(email);

      if (!isVerified) {
        // 邮箱未验证，拒绝登录
        res.status(403).json({
          success: false,
          error: 'Email not verified',
          message: 'Please verify your email before logging in',
          requiresEmailVerification: true,
          email,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          isEmailVerified: isVerified,
        },
        message: 'Login successful',
      });
    } catch (error: any) {
      logger.error('Login controller error:', error);
      next(error);
    }
  }

  /**
   * Login with Google
   */
  async loginWithGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, email, name, picture } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Google user info is required',
        });
        return;
      }

      const result = await authService.loginWithGoogle({
        id,
        email,
        name,
        picture,
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        message: 'Google login successful',
      });
    } catch (error: any) {
      logger.error('Google login controller error:', error);
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required',
        });
        return;
      }

      const result = authService.refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        data: {
          accessToken: result.accessToken,
        },
        message: 'Token refreshed successfully',
      });
    } catch (error: any) {
      logger.error('Refresh token controller error:', error);
      next(error);
    }
  }

  /**
   * Get current user info
   */
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const user = await authService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error: any) {
      logger.error('Get user info controller error:', error);
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // In a real app, you might want to blacklist the token
      // or remove refresh token from database

      res.status(200).json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error: any) {
      logger.error('Logout controller error:', error);
      next(error);
    }
  }
}

export default new AuthController();
