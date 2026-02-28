// ChatService is deprecated, use conversationService and contactService instead
// This file is kept for backward compatibility during migration

import prisma from '../config/database';
import logger from '../utils/logger';

class ChatService {
  /**
   * @deprecated Use conversationService.getConversationsWithUnread instead
   */
  async getUserChatSessions(userId: string, pagination?: any) {
    logger.warn('getUserChatSessions is deprecated, use conversationService.getConversationsWithUnread');
    return { sessions: [], pagination: { page: 1, limit: 20, total: 0 } };
  }

  /**
   * @deprecated Use conversationService.getConversationInfo instead
   */
  async getChatSession(id: string, userId: string) {
    logger.warn('getChatSession is deprecated, use conversationService.getConversationInfo');
    return null;
  }

  /**
   * @deprecated
   */
  async createChatSession(userId: string, participantIds: string[], name?: string, type: 'direct' | 'group' = 'direct') {
    logger.warn('createChatSession is deprecated, use conversationService.getOrCreateDirectConversationState');
    return null;
  }

  /**
   * @deprecated
   */
  async updateChatSession(id: string, userId: string, data: any) {
    logger.warn('updateChatSession is deprecated');
    return null;
  }

  /**
   * @deprecated
   */
  async deleteChatSession(id: string, userId: string) {
    logger.warn('deleteChatSession is deprecated');
    return { success: true };
  }

  /**
   * @deprecated Use conversationService.updateUserReadStatus instead
   */
  async markChatAsRead(id: string, userId: string) {
    logger.warn('markChatAsRead is deprecated, use conversationService.updateUserReadStatus');
    return { success: true };
  }

  /**
   * @deprecated
   */
  private async findDirectChatSession(userId: string, otherUserId: string) {
    return null;
  }
}

export default new ChatService();
