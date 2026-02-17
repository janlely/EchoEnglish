import prisma from '../config/database';
import logger from '../utils/logger';
import { TransactionalEmailsApi, SendSmtpEmail, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

// 初始化 Brevo 客户端
const transactionalEmailsApi = new TransactionalEmailsApi();
if (process.env.BREVO_API_KEY) {
  transactionalEmailsApi.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);
}

class EmailVerificationService {
  /**
   * 生成 6 位验证码
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 创建或更新验证码
   */
  async createVerificationCode(email: string, userId: string) {
    try {
      const code = this.generateCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟过期

      // 检查是否已有验证记录
      const existing = await prisma.emailVerification.findUnique({
        where: { email },
      });

      if (existing) {
        // 更新现有记录
        await prisma.emailVerification.update({
          where: { email },
          data: {
            code,
            userId,
            expiresAt,
            isVerified: false,
          },
        });
      } else {
        // 创建新记录
        await prisma.emailVerification.create({
          data: {
            email,
            code,
            userId,
            expiresAt,
          },
        });
      }

      // 发送验证邮件
      await this.sendVerificationEmail(email, code);

      logger.info(`📧 Email verification code sent to ${email}`);
      
      return { success: true };
    } catch (error: any) {
      logger.error('Create verification code error:', error);
      throw error;
    }
  }

  /**
   * 验证邮箱
   */
  async verifyEmail(email: string, code: string) {
    try {
      const verification = await prisma.emailVerification.findUnique({
        where: { email },
      });

      if (!verification) {
        throw new Error('Verification record not found');
      }

      if (verification.isVerified) {
        throw new Error('Email already verified');
      }

      if (verification.code !== code) {
        throw new Error('Invalid verification code');
      }

      if (new Date() > verification.expiresAt) {
        throw new Error('Verification code expired');
      }

      // 更新验证状态
      await prisma.emailVerification.update({
        where: { email },
        data: {
          isVerified: true,
        },
      });

      // 更新用户状态
      await prisma.user.update({
        where: { id: verification.userId },
        data: {
          // 可以添加 isEmailVerified 字段
        },
      });

      logger.info(`Email verified: ${email}`);

      return { success: true };
    } catch (error: any) {
      logger.error('Verify email error:', error);
      throw error;
    }
  }

  /**
   * 检查邮箱是否已验证
   */
  async isEmailVerified(email: string): Promise<boolean> {
    try {
      const verification = await prisma.emailVerification.findUnique({
        where: { email },
      });

      return verification?.isVerified ?? false;
    } catch (error: any) {
      logger.error('Check email verification error:', error);
      return false;
    }
  }

  /**
   * 重新发送验证码
   */
  async resendCode(email: string, userId: string) {
    return this.createVerificationCode(email, userId);
  }

  /**
   * 发送验证邮件（使用 Brevo）
   */
  private async sendVerificationEmail(email: string, code: string) {
    try {
      const subject = 'EchoEnglish - 邮箱验证码';
      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background-color: #f8f9fa;
                border-radius: 10px;
                padding: 30px;
                text-align: center;
              }
              .logo {
                font-size: 40px;
                margin-bottom: 20px;
              }
              h1 {
                color: #007AFF;
                margin-bottom: 10px;
              }
              .code {
                background-color: #ffffff;
                border: 2px dashed #007AFF;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                color: #007AFF;
              }
              .expiry {
                color: #666;
                font-size: 14px;
                margin-top: 15px;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e0e0e0;
                font-size: 12px;
                color: #999;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="logo">📧</div>
              <h1>邮箱验证码</h1>
              <p>欢迎使用 EchoEnglish！</p>
              <p>您的邮箱验证码是：</p>
              <div class="code">${code}</div>
              <p class="expiry">验证码 10 分钟内有效</p>
              <p style="margin-top: 20px;">如果不是您本人操作，请忽略此邮件。</p>
              <div class="footer">
                <p>© 2024 EchoEnglish. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const message = new SendSmtpEmail();
      message.subject = subject;
      message.htmlContent = htmlContent;
      message.sender = {
        email: 'noreply@echoenglish.com',
        name: 'EchoEnglish',
      };
      message.to = [{ email }];

      await transactionalEmailsApi.sendTransacEmail(message);

      logger.info(`Brevo email sent to ${email}`);
    } catch (error: any) {
      logger.error('Send Brevo email error:', error.message);
      // 开发环境如果 Brevo 失败，回退到日志输出
      if (process.env.NODE_ENV === 'development') {
        logger.info(`📧 Development mode - Verification code: ${code}`);
      }
      throw error;
    }
  }
}

export default new EmailVerificationService();
