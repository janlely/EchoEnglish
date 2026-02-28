import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import conversationService from '../services/conversation.service';
import logger from '../utils/logger';

interface ConversationInfo {
  conversationId: string;
  type: 'direct' | 'group';
  targetId: string;
  name: string;
  avatarUrl?: string | null;
  unreadCount: number;
  lastReadMsgId?: string | null;
}

class ConversationController {
  /**
   * 获取有未读消息的会话列表
   */
  async getConversationsWithUnread(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const conversations = await conversationService.getConversationsWithUnread(userId);

      res.status(200).json({
        success: true,
        data: { conversations },
      });
    } catch (error: any) {
      logger.error('Get conversations with unread controller error:', error);
      next(error);
    }
  }

  /**
   * 获取会话详情（进入会话时调用）
   */
  async getConversationInfo(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;

      const info = await conversationService.getConversationInfo(userId, conversationId);

      res.status(200).json({
        success: true,
        data: info,
      });
    } catch (error: any) {
      logger.error('Get conversation info controller error:', error);
      next(error);
    }
  }

  /**
   * 更新会话读状态
   */
  async updateReadStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { conversationId } = req.params;
      const { lastReadMsgId } = req.body;

      if (!lastReadMsgId) {
        res.status(400).json({
          success: false,
          error: 'lastReadMsgId is required',
        });
        return;
      }

      const result = await conversationService.updateUserReadStatus(userId, conversationId, lastReadMsgId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Update read status controller error:', error);
      next(error);
    }
  }
}

export default new ConversationController();
