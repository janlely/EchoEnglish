import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import notificationService from '../services/notification.service';
import logger from '../utils/logger';

class NotificationController {
  /**
   * Get user notifications
   */
  async getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await notificationService.getUserNotifications(userId, {
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Get notifications controller error:', error);
      next(error);
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const count = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      logger.error('Get unread count controller error:', error);
      next(error);
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { notificationId } = req.params;

      const notification = await notificationService.markNotificationAsRead(
        notificationId,
        userId
      );

      res.status(200).json({
        success: true,
        data: { notification },
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      logger.error('Mark notification as read controller error:', error);
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const result = await notificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      logger.error('Mark all as read controller error:', error);
      next(error);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { notificationId } = req.params;

      const result = await notificationService.deleteNotification(notificationId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Notification deleted',
      });
    } catch (error: any) {
      logger.error('Delete notification controller error:', error);
      next(error);
    }
  }
}

export default new NotificationController();
