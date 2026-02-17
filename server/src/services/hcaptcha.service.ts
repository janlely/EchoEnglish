import axios from 'axios';
import logger from '../utils/logger';

class CaptchaService {
  /**
   * 验证 Cloudflare Turnstile token
   */
  async verifyTurnstile(token: string, ip?: string) {
    try {
      const secret = process.env.TURNSTILE_SECRET_KEY;
      
      if (!secret) {
        logger.warn('TURNSTILE_SECRET_KEY not configured');
        return { success: true }; // 开发环境如果没有配置，跳过验证
      }

      const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          secret,
          response: token,
          remoteip: ip,
        }
      );

      const data = response.data;

      if (!data.success) {
        logger.error('Turnstile verification failed:', data['error-codes']);
        return {
          success: false,
          errors: data['error-codes'],
        };
      }

      logger.info('Turnstile verified successfully');
      return { success: true };
    } catch (error: any) {
      logger.error('Turnstile verification error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 验证 hCaptcha token（备用）
   */
  async verifyToken(token: string, ip?: string) {
    try {
      const secret = process.env.HCAPTCHA_SECRET;
      
      if (!secret) {
        logger.warn('HCAPTCHA_SECRET not configured');
        return { success: true }; // 开发环境如果没有配置，跳过验证
      }

      const response = await axios.post(
        'https://api.hcaptcha.com/siteverify',
        null,
        {
          params: {
            secret,
            response: token,
            remoteip: ip,
          },
        }
      );

      const data = response.data;

      if (!data.success) {
        logger.error('hCaptcha verification failed:', data['error-codes']);
        return {
          success: false,
          errors: data['error-codes'],
        };
      }

      logger.info('hCaptcha verified successfully');
      return { success: true };
    } catch (error: any) {
      logger.error('hCaptcha verification error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default new CaptchaService();
