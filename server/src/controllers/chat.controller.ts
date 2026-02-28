import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import chatService from '../services/chat.service';
import logger from '../utils/logger';

class ChatController {
  /**
   * Create chat session
   */
  async createChat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { participantIds, name, type } = req.body;

      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Participant IDs are required',
        });
        return;
      }

      const session = await chatService.createChatSession(
        userId,
        participantIds,
        name,
        type
      );

      res.status(201).json({
        success: true,
        data: { session },
        message: 'Chat session created successfully',
      });
    } catch (error: any) {
      logger.error('Create chat controller error:', error);
      next(error);
    }
  }

  /**
   * Get user's chat sessions
   */
  async getChats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await chatService.getUserChatSessions(userId, { page, limit });

      res.status(200).json({
        success: true,
        data: result,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Get chats controller error:', error);
      next(error);
    }
  }

  /**
   * Get chat session details
   */
  async getChat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const session = await chatService.getChatSession(id, userId);

      res.status(200).json({
        success: true,
        data: { session },
      });
    } catch (error: any) {
      logger.error('Get chat controller error:', error);
      next(error);
    }
  }

  /**
   * Update chat session
   */
  async updateChat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { name, avatarUrl } = req.body;

      const session = await chatService.updateChatSession(id, userId, {
        name,
        avatarUrl,
      });

      res.status(200).json({
        success: true,
        data: { session },
        message: 'Chat session updated successfully',
      });
    } catch (error: any) {
      logger.error('Update chat controller error:', error);
      next(error);
    }
  }

  /**
   * Delete chat session
   */
  async deleteChat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await chatService.deleteChatSession(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Chat session deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete chat controller error:', error);
      next(error);
    }
  }

  /**
   * Mark chat as read
   */
  async markChatAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const result = await chatService.markChatAsRead(id, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Chat marked as read',
      });
    } catch (error: any) {
      logger.error('Mark chat as read controller error:', error);
      next(error);
    }
  }
}

export default new ChatController();
