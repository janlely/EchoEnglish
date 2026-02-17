import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import logger from '../utils/logger';
import { PaginationParams } from '../types';

class NotificationService {
  /**
   * 解析 notification 数据（将 JSON 字符串转换为对象）
   */
  private parseNotificationData(notification: any) {
    return {
      ...notification,
      data: notification.data ? JSON.parse(notification.data) : null,
    };
  }

  /**
   * Create a notification
   */
  async createNotification(data: {
    userId: string;
    type: 'message' | 'friend_request' | 'system';
    title: string;
    message: string;
    data?: Record<string, any>;
  }) {
    try {
      const notification = await prisma.notification.create({
        data: {
          id: uuidv4(),
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          // 将对象序列化为 JSON 字符串（SQLite 不支持 Json 类型）
          data: data.data ? JSON.stringify(data.data) : null,
        },
      });

      logger.info(`Notification created: ${notification.id} for user ${data.userId}`);

      return notification;
    } catch (error: any) {
      logger.error('Create notification error:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId: string, params: PaginationParams = {}) {
    try {
      const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = params;

      const skip = (page - 1) * limit;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      });

      const total = await prisma.notification.count({
        where: { userId },
      });

      return {
        data: notifications.map(n => this.parseNotificationData(n)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error('Get notifications error:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return count;
    } catch (error: any) {
      logger.error('Get unread count error:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.userId !== userId) {
        throw new Error('Access denied');
      }

      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });

      logger.info(`Notification marked as read: ${notificationId}`);

      return this.parseNotificationData(updatedNotification);
    } catch (error: any) {
      logger.error('Mark notification as read error:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      logger.info(`All notifications marked as read for user ${userId}`);

      return { success: true, count: result.count };
    } catch (error: any) {
      logger.error('Mark all as read error:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.userId !== userId) {
        throw new Error('Access denied');
      }

      await prisma.notification.delete({
        where: { id: notificationId },
      });

      logger.info(`Notification deleted: ${notificationId}`);

      return { success: true };
    } catch (error: any) {
      logger.error('Delete notification error:', error);
      throw error;
    }
  }

  /**
   * Send message notification
   */
  async sendMessageNotification(
    recipientId: string,
    senderName: string,
    messageText: string,
    chatSessionId: string
  ) {
    return this.createNotification({
      userId: recipientId,
      type: 'message',
      title: '新消息',
      message: `${senderName}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`,
      data: {
        chatSessionId,
        senderName,
      },
    });
  }
}

export default new NotificationService();
