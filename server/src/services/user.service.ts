import prisma from '../config/database';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

class UserService {
  /**
   * Generate unique avatar filename with timestamp for cache busting
   */
  private generateAvatarFilename(userId: string, ext: string = 'jpg'): string {
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `${userId}_${timestamp}_${randomSuffix}.${ext}`;
  }

  /**
   * Clean up old avatar files for a user
   */
  private cleanupOldAvatars(avatarDir: string, userId: string): void {
    try {
      const files = fs.readdirSync(avatarDir);
      const userAvatarPattern = new RegExp(`^${userId}_[0-9]+_[a-f0-9]+\\.[a-z]+$`);

      for (const file of files) {
        if (userAvatarPattern.test(file)) {
          const filePath = path.join(avatarDir, file);
          fs.unlinkSync(filePath);
          logger.info(`[UserService] Cleaned up old avatar: ${file}`);
        }
      }
    } catch (error) {
      logger.warn(`[UserService] Failed to cleanup old avatars: ${error}`);
    }
  }

  /**
   * Upload and save avatar from base64 data
   * @param userId - User ID
   * @param base64Data - Base64 encoded image data
   * @param filename - Original filename
   * @returns Avatar URL
   */
  async uploadAvatarFromBase64(userId: string, base64Data: string, filename: string) {
    try {
      logger.info(`[UserService] Uploading avatar from base64 for user ${userId}`);

      const avatarDir = path.join(__dirname, '../../uploads/avatars');

      // Create directory if not exists
      if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
      }

      // Clean up old avatars
      this.cleanupOldAvatars(avatarDir, userId);

      // Detect extension from filename or default to jpg
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';

      // Generate unique filename with timestamp
      const fileName = this.generateAvatarFilename(userId, ext);
      const filePath = path.join(avatarDir, fileName);

      // Remove data:image prefix if present
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

      // Convert base64 to buffer and save
      const buffer = Buffer.from(cleanBase64, 'base64');
      fs.writeFileSync(filePath, buffer);

      // Update user's avatarUrl in database
      const avatarUrl = `/uploads/avatars/${fileName}`;

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl },
        });
        logger.info(`[UserService] Avatar uploaded and user updated for user ${userId}`);
      } catch (error: any) {
        // User not found, just save the file
        logger.warn(`[UserService] User ${userId} not found, avatar saved but not linked to user`);
      }

      logger.info(`[UserService] Avatar uploaded successfully for user ${userId}`);

      return { avatarUrl };
    } catch (error: any) {
      logger.error('[UserService] Upload avatar error:', error);
      throw error;
    }
  }

  /**
   * Upload and save avatar
   * @param userId - User ID
   * @param file - Image file (Buffer)
   * @returns Avatar URL
   */
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    try {
      logger.info(`[UserService] Uploading avatar for user ${userId}`);

      // Validate file
      if (!file) {
        throw new Error('No file uploaded');
      }

      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('File size must be less than 2MB');
      }

      const avatarDir = path.join(__dirname, '../../uploads/avatars');

      // Create directory if not exists
      if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
      }

      // Clean up old avatars
      this.cleanupOldAvatars(avatarDir, userId);

      // Detect extension from mimetype or originalname
      const ext = file.originalname.split('.').pop()?.toLowerCase() ||
                  file.mimetype.split('/')[1] || 'jpg';

      // Generate unique filename with timestamp
      const fileName = this.generateAvatarFilename(userId, ext);
      const filePath = path.join(avatarDir, fileName);

      fs.writeFileSync(filePath, file.buffer);

      // Update user's avatarUrl in database
      const avatarUrl = `/uploads/avatars/${fileName}`;

      try {
        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl },
        });
        logger.info(`[UserService] Avatar uploaded and user updated for user ${userId}`);
      } catch (error: any) {
        // User not found, just save the file
        logger.warn(`[UserService] User ${userId} not found, avatar saved but not linked to user`);
      }

      logger.info(`[UserService] Avatar uploaded successfully for user ${userId}`);

      return { avatarUrl };
    } catch (error: any) {
      logger.error('[UserService] Upload avatar error:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          isOnline: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error: any) {
      logger.error('[UserService] Get user profile error:', error);
      throw error;
    }
  }
}

export default new UserService();
