import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import emailVerificationService from '../services/emailVerification.service';
import captchaService from '../services/hcaptcha.service';
import logger from '../utils/logger';

class EmailVerificationController {
  /**
   * 发送验证邮件
   */
  async sendVerificationCode(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Email is required',
        });
        return;
      }

      await emailVerificationService.createVerificationCode(
        email,
        userId
      );

      // 开发环境返回验证码（方便测试）
      res.status(200).json({
        success: true,
        message: 'Verification code sent',
      });
    } catch (error: any) {
      logger.error('Send verification code error:', error);
      next(error);
    }
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(req: Request, res: Response) {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        res.status(400).json({
          success: false,
          error: 'Email and code are required',
        });
        return;
      }

      const result = await emailVerificationService.verifyEmail(email, code);

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: result,
      });
    } catch (error: any) {
      logger.error('Verify email error:', error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 检查邮箱验证状态
   */
  async checkVerificationStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const email = req.user!.email;
      const isVerified = await emailVerificationService.isEmailVerified(email);

      res.status(200).json({
        success: true,
        data: { isVerified },
      });
    } catch (error: any) {
      logger.error('Check verification status error:', error);
      next(error);
    }
  }

  /**
   * 重新发送验证码
   */
  async resendCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, hcaptcha_token } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Email is required',
        });
        return;
      }

      if (!hcaptcha_token) {
        res.status(400).json({
          success: false,
          error: 'Captcha token is required',
        });
        return;
      }

      // 验证 Cloudflare Turnstile
      const captchaResult = await captchaService.verifyTurnstile(
        hcaptcha_token,
        req.ip
      );

      if (!captchaResult.success) {
        res.status(400).json({
          success: false,
          error: 'Captcha verification failed',
          details: captchaResult.errors || captchaResult.error,
        });
        return;
      }

      // Captcha 验证通过，发送验证码
      await emailVerificationService.resendCode(email, 'unknown');

      res.status(200).json({
        success: true,
        message: 'Verification code resent',
      });
    } catch (error: any) {
      logger.error('Resend code error:', error);
      next(error);
    }
  }
}

export default new EmailVerificationController();
