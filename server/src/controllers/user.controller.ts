import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import userService from '../services/user.service';
import logger from '../utils/logger';

class UserController {
  /**
   * Get current user profile
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      logger.info(`Get profile for user ${userId}`);

      const user = await userService.getUserProfile(userId);

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error: any) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  /**
   * Upload user avatar
   * Supports both multipart/form-data (file upload) and JSON (base64 data)
   */
  async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || 'test_user_id';

      // Case 1: multipart/form-data file upload (from react-native-blob-util)
      if (req.file) {
        logger.info(`Upload avatar (multipart) for user ${userId}, file size: ${req.file.size}`);

        const result = await userService.uploadAvatar(userId, req.file);

        res.status(200).json({
          success: true,
          data: result,
          message: 'Avatar uploaded successfully',
        });
        return;
      }

      // Case 2: JSON with base64 data (fallback)
      const { avatar, filename } = req.body;

      if (!avatar) {
        res.status(400).json({
          success: false,
          error: 'No avatar data provided',
        });
        return;
      }

      logger.info(`Upload avatar for user ${userId}, base64 length: ${avatar.length}`);

      const result = await userService.uploadAvatarFromBase64(userId, avatar, filename || 'avatar.jpg');

      res.status(200).json({
        success: true,
        data: result,
        message: 'Avatar uploaded successfully',
      });
    } catch (error: any) {
      logger.error('Upload avatar error:', error);
      next(error);
    }
  }
}

export default new UserController();
