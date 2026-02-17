import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import messageService from '../services/message.service';
import logger from '../utils/logger';

class MessageController {
  /**
   * Send message
   */
  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { chatSessionId } = req.params;
      const { text, type } = req.body;

      if (!text || !text.trim()) {
        res.status(400).json({
          success: false,
          error: 'Message text is required',
        });
        return;
      }

      const message = await messageService.sendMessage(
        chatSessionId,
        userId,
        text,
        type
      );

      res.status(201).json({
        success: true,
        data: { message },
        message: 'Message sent successfully',
      });
    } catch (error: any) {
      logger.error('Send message controller error:', error);
      next(error);
    }
  }

  /**
   * Get messages
   */
  async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { chatSessionId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await messageService.getMessages(chatSessionId, userId, {
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Get messages controller error:', error);
      next(error);
    }
  }

  /**
   * Update message
   */
  async updateMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { messageId } = req.params;
      const { text } = req.body;

      const message = await messageService.updateMessage(messageId, userId, text);

      res.status(200).json({
        success: true,
        data: { message },
        message: 'Message updated successfully',
      });
    } catch (error: any) {
      logger.error('Update message controller error:', error);
      next(error);
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { messageId } = req.params;

      const result = await messageService.deleteMessage(messageId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Message deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete message controller error:', error);
      next(error);
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { chatSessionId } = req.params;

      const result = await messageService.markMessagesAsRead(chatSessionId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Messages marked as read',
      });
    } catch (error: any) {
      logger.error('Mark messages as read controller error:', error);
      next(error);
    }
  }
}

export default new MessageController();
