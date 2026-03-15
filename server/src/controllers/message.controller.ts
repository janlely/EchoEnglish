import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import messageService from '../services/message.service';
import conversationService from '../services/conversation.service';
import logger from '../utils/logger';
import { generateDirectConversationId, generateGroupConversationId } from '../utils/conversationId';

class MessageController {
  /**
   * Send message
   */
  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const { text, type, msgId, chatType = 'direct' } = req.body;

      if (!text || !text.trim()) {
        res.status(400).json({
          success: false,
          error: 'Message text is required',
        });
        return;
      }

      const message = await messageService.sendMessage(
        conversationId,
        userId,
        text,
        type,
        msgId,
        chatType
      );

      res.status(201).json({
        success: true,
        data: { message },
        message: 'Message sent successfully',
      });
    } catch (error: any) {
      // 业务错误使用 info 级别，其他错误使用 error 级别
      if (error.message === '本群已解散' || error.message === '您不是群成员' || error.message === 'Access denied') {
        logger.info('Send message controller error:', error.message);
      } else {
        logger.error('Send message controller error:', error);
      }
      next(error);
    }
  }

  /**
   * Get messages
   */
  async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const chatType = (req.query.chatType as string) || 'direct';

      const result = await messageService.getMessages(conversationId, userId, {
        page,
        limit,
      }, chatType as 'direct' | 'group');

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
      const { conversationId } = req.params;
      const chatType = (req.query.chatType as string) || 'direct';

      const result = await messageService.markMessagesAsRead(conversationId, userId, chatType as 'direct' | 'group');

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

  /**
   * Sync messages - get messages after afterSeq and mark them as read
   * Supports batch loading with afterSeq and limit parameters
   */
  async syncMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id; // Current user ID
      const { conversationId, chatType, afterSeq, limit } = req.query;

      if (!conversationId) {
        res.status(400).json({
          success: false,
          error: 'conversationId is required',
        });
        return;
      }

      const result = await messageService.syncMessages(
        userId,
        conversationId as string,
        (chatType as string) || 'direct',
        afterSeq ? parseInt(afterSeq as string) : undefined,  // Optional: start from this seq
        limit ? parseInt(limit as string) : 50  // Optional: batch size
      );

      logger.info(`Synced ${result.messages.length} messages for user ${userId}, conversation: ${conversationId}, hasMore: ${result.hasMore}`);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      // 业务错误（如群已解散）使用 info 级别，其他错误使用 error 级别
      if (error.message === '本群已解散' || error.message === '您不是群成员' || error.message === 'Access denied') {
        logger.info('Sync messages controller error:', error.message);
      } else {
        logger.error('Sync messages controller error:', error);
      }
      next(error);
    }
  }

  /**
   * Acknowledge and update lastReadSeq
   */
  async ackMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id; // Current user ID
      const { conversationId, minSeq } = req.body;

      logger.info(`[MessageController] ackMessages: userId=${userId}, conversationId=${conversationId}, minSeq=${minSeq}`);

      if (!conversationId || minSeq === undefined) {
        logger.warn('[MessageController] ackMessages: missing params', { conversationId, minSeq });
        res.status(400).json({
          success: false,
          error: 'conversationId and minSeq are required',
        });
        return;
      }

      const result = await messageService.ackMessages(
        userId,
        conversationId,
        parseInt(minSeq as string)
      );

      logger.info('[MessageController] ackMessages: success', result);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Ack messages controller error:', error);
      next(error);
    }
  }

  /**
   * Sync messages with seq gap
   * Returns messages between fromSeq and toSeq (exclusive)
   */
  async syncSeqGap(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId, fromSeq, toSeq } = req.query;

      if (!conversationId || !fromSeq || !toSeq) {
        res.status(400).json({
          success: false,
          error: 'conversationId, fromSeq, and toSeq are required',
        });
        return;
      }

      const messages = await messageService.syncSeqGap(
        conversationId as string,
        parseInt(fromSeq as string),
        parseInt(toSeq as string)
      );

      res.status(200).json({
        success: true,
        data: { messages },
      });
    } catch (error: any) {
      logger.error('Sync seq gap controller error:', error);
      next(error);
    }
  }

  /**
   * Sync session list with unread count
   */
  async syncSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const sessions = await messageService.getSessionList(userId);

      logger.info(`Synced ${sessions.length} sessions for user ${userId}`);

      res.status(200).json({
        success: true,
        data: { sessions },
      });
    } catch (error: any) {
      logger.error('Sync sessions controller error:', error);
      next(error);
    }
  }

  /**
   * Get or create direct conversation
   */
  async getOrCreateDirectConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.params;

      if (!otherUserId) {
        res.status(400).json({
          success: false,
          error: 'otherUserId is required',
        });
        return;
      }

      const conversation = await conversationService.getOrCreateDirectConversationState(userId, otherUserId);

      res.status(200).json({
        success: true,
        data: { conversation },
      });
    } catch (error: any) {
      logger.error('Get or create direct conversation error:', error);
      next(error);
    }
  }

  /**
   * Get conversations with unread messages
   */
  async getConversationsWithUnread(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const conversations = await conversationService.getConversationsWithUnread(userId);

      logger.info(`Got ${conversations.length} conversations with unread for user ${userId}`);

      res.status(200).json({
        success: true,
        data: { conversations },
      });
    } catch (error: any) {
      logger.error('Get conversations with unread error:', error);
      next(error);
    }
  }
}

export default new MessageController();
