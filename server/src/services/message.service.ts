import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import logger from '../utils/logger';
import { PaginationParams } from '../types';
import conversationService from './conversation.service';
import redisService from './redis.service';
import {
  generateDirectConversationId,
  generateGroupConversationId,
  isGroupConversation,
  getOtherUserIdFromConversationId,
} from '../utils/conversationId';

class MessageService {
  /**
   * Send a message
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
    type: 'text' | 'image' | 'file' = 'text',
    msgId?: string,
    chatType: 'direct' | 'group' = 'direct'
  ) {
    try {
      logger.info(`[MessageService] sendMessage: conversationId=${conversationId}, senderId=${senderId}, msgId=${msgId}, chatType=${chatType}`);

      // 去重检查：如果提供了 msgId，检查是否已存在
      if (msgId) {
        const existingMessage = await prisma.message.findUnique({
          where: { msgId },
        });

        if (existingMessage) {
          logger.info(`[MessageService] Duplicate message detected, returning existing: ${existingMessage.id}`);
          return {
            id: existingMessage.id,
            msgId: existingMessage.msgId,
            text: existingMessage.text,
            type: existingMessage.type,
            status: existingMessage.status,
            senderId: existingMessage.senderId,
            conversationId: existingMessage.conversationId,
            sender: {
              id: existingMessage.senderId,
              name: 'Sender',
              avatarUrl: null,
            },
            createdAt: existingMessage.createdAt,
          };
        }
      }

      // 根据聊天类型进行权限检查（基于 conversationId 格式判断，不依赖前端传入的 chatType）
      const isGroup = isGroupConversation(conversationId);

      if (isGroup) {
        // 群聊：检查用户是否是群成员
        const groupId = conversationId.replace('group_', '');
        const participant = await prisma.groupMember.findFirst({
          where: {
            groupId,
            userId: senderId,
          },
        });

        if (!participant) {
          logger.error(`[MessageService] Access denied: user ${senderId} is not member of group ${groupId}`);
          throw new Error('Access denied');
        }

        logger.info(`[MessageService] Group chat permission check passed`);
      } else {
        // 私聊：检查发送者和接收者是否是好友
        const otherUserId = getOtherUserIdFromConversationId(conversationId, senderId);
        if (!otherUserId) {
          logger.error(`[MessageService] Invalid conversation ID for direct chat: ${conversationId}`);
          throw new Error('Invalid conversation ID');
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: senderId, userId2: otherUserId },
              { userId1: otherUserId, userId2: senderId },
            ],
          },
        });

        logger.info(`[MessageService] Friendship check result:`, friendship ? 'found' : 'not found');

        if (!friendship) {
          logger.error(`[MessageService] Access denied: user ${senderId} and ${otherUserId} are not friends`);
          throw new Error('Access denied');
        }

        logger.info(`[MessageService] Direct chat permission check passed`);
      }

      // Get next sequence number
      let seq = await redisService.getNextSeq(conversationId);
      
      // Fallback to database if Redis is unavailable
      if (!seq) {
        logger.warn('[MessageService] Redis unavailable, falling back to DB for seq');
        const lastMessage = await prisma.message.findFirst({
          where: { conversationId },
          orderBy: { seq: 'desc' },
          select: { seq: true },
        });
        seq = (lastMessage?.seq || 0) + 1;
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          id: uuidv4(),
          msgId: msgId || uuidv4(),
          seq,
          conversationId,
          text,
          type,
          senderId,
          status: 'sent',
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      logger.info(`[MessageService] Message created: ${message.id}, seq: ${seq}`);

      // Get sender info from the included relation
      const senderInfo = {
        id: message.senderId,
        name: message.sender?.name || 'Sender',
        avatarUrl: message.sender?.avatarUrl || null,
      };

      // Update conversation state (only for group chat)
      await conversationService.updateConversationState(
        conversationId,
        message.seq,
        text,
        senderId,
        message.createdAt
      );

      // Increment unread count for the other participant(s)
      if (!isGroup) {
        const otherUserId = getOtherUserIdFromConversationId(conversationId, senderId);
        if (otherUserId) {
          await conversationService.incrementUnreadCount(otherUserId, conversationId);
        }
      } else {
        // For group chat, increment unread count for all other participants
        const participants = await prisma.groupMember.findMany({
          where: {
            groupId: conversationId.replace('group_', ''),
            userId: { not: senderId },
          },
          select: {
            userId: true,
          },
          distinct: ['userId'], // Ensure unique userIds
        });

        for (const participant of participants) {
          await conversationService.incrementUnreadCount(participant.userId, conversationId);
        }
      }

      return {
        id: message.id,
        msgId: message.msgId,
        seq: message.seq,
        text: message.text,
        type: message.type,
        status: message.status,
        senderId: message.senderId,
        conversationId: message.conversationId,
        chatType,
        sender: senderInfo,
        createdAt: message.createdAt,
      };
    } catch (error: unknown) {
      logger.error('Send message error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    userId: string,
    params: PaginationParams = {},
    chatType: 'direct' | 'group' = 'direct'
  ) {
    try {
      const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = params;

      // 根据聊天类型进行权限检查（基于 conversationId 格式判断，不依赖前端传入的 chatType）
      const isGroup = isGroupConversation(conversationId);

      if (isGroup) {
        const groupId = conversationId.replace('group_', '');
        const participant = await prisma.groupMember.findFirst({
          where: {
            groupId,
            userId,
          },
        });

        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        // 私聊：检查好友关系
        const otherUserId = getOtherUserIdFromConversationId(conversationId, userId);
        if (!otherUserId) {
          throw new Error('Invalid conversation ID');
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: otherUserId },
              { userId1: otherUserId, userId2: userId },
            ],
          },
        });

        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      const skip = (page - 1) * limit;

      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      });

      const total = await prisma.message.count({
        where: { conversationId },
      });

      return {
        data: messages.map((msg) => ({
          id: msg.id,
          msgId: msg.msgId,
          seq: msg.seq,
          text: msg.text,
          type: msg.type,
          status: msg.status,
          senderId: msg.senderId,
          conversationId: msg.conversationId,
          sender: {
            id: msg.sender.id,
            name: msg.sender.name,
            avatarUrl: msg.sender.avatarUrl,
          },
          createdAt: msg.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
        },
      };
    } catch (error: any) {
      logger.error('Get messages error:', error);
      throw error;
    }
  }

  /**
   * Update message status
   */
  async updateMessageStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read'
  ) {
    try {
      const message = await prisma.message.update({
        where: { id: messageId },
        data: { status },
      });

      logger.info(`Message status updated: ${messageId} to ${status}`);

      return message;
    } catch (error: any) {
      logger.error('Update message status error:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read by conversation
   */
  async markMessagesAsRead(
    conversationId: string,
    userId: string,
    chatType: 'direct' | 'group' = 'direct'
  ) {
    try {
      // 根据聊天类型进行权限检查（基于 conversationId 格式判断，不依赖前端传入的 chatType）
      const isGroup = isGroupConversation(conversationId);

      if (isGroup) {
        const groupId = conversationId.replace('group_', '');
        const participant = await prisma.groupMember.findFirst({
          where: {
            groupId,
            userId,
          },
        });

        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        // 私聊：检查好友关系
        const otherUserId = getOtherUserIdFromConversationId(conversationId, userId);
        if (!otherUserId) {
          throw new Error('Invalid conversation ID');
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: otherUserId },
              { userId1: otherUserId, userId2: userId },
            ],
          },
        });

        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      // Get the latest message msgId
      const latestMessage = await prisma.message.findFirst({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
      });

      if (!latestMessage) {
        return { success: true, count: 0 };
      }

      // Update user's read status using UserConversationState
      await conversationService.updateUserReadStatus(userId, conversationId, latestMessage.seq);

      // Mark messages as read
      const result = await prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          status: { not: 'read' },
        },
        data: {
          status: 'read',
        },
      });

      logger.info(`Marked ${result.count} messages as read for user ${userId}, conversation ${conversationId}`);
      return { success: true, count: result.count };
    } catch (error: any) {
      logger.error('Mark messages as read error:', error);
      throw error;
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string, userId: string) {
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      if (message.senderId !== userId) {
        throw new Error('Unauthorized');
      }

      await prisma.message.delete({
        where: { id: messageId },
      });

      logger.info(`Message deleted: ${messageId}`);

      return { success: true };
    } catch (error: any) {
      logger.error('Delete message error:', error);
      throw error;
    }
  }

  /**
   * Update message
   */
  async updateMessage(messageId: string, userId: string, text: string) {
    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new Error('Message not found');
      }

      if (message.senderId !== userId) {
        throw new Error('Unauthorized');
      }

      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: { text },
      });

      logger.info(`Message updated: ${messageId}`);

      return {
        id: updatedMessage.id,
        text: updatedMessage.text,
        status: updatedMessage.status,
        createdAt: updatedMessage.createdAt,
      };
    } catch (error: any) {
      logger.error('Update message error:', error);
      throw error;
    }
  }

  /**
   * Get messages after a specific msgId
   */
  async getMessagesAfter(
    userId: string,
    conversationId: string,
    msgId?: string
  ) {
    try {
      // Verify permission (friend or group member)
      const isGroup = isGroupConversation(conversationId);

      if (isGroup) {
        const groupId = conversationId.replace('group_', '');
        const participant = await prisma.groupMember.findFirst({
          where: { groupId, userId },
        });
        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        const otherUserId = getOtherUserIdFromConversationId(conversationId, userId);
        if (!otherUserId) {
          throw new Error('Invalid conversation ID');
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: otherUserId },
              { userId1: otherUserId, userId2: userId },
            ],
          },
        });
        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      // Build query
      const where: any = { conversationId };

      // If msgId is provided, get messages with msgId > lastMsgId
      if (msgId) {
        where.msgId = { gt: msgId };
      }

      const messages = await prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      logger.info(`Get messages after ${msgId || 'start'} for conversation ${conversationId}: ${messages.length} messages`);

      return messages.map(msg => ({
        id: msg.id,
        msgId: msg.msgId,
        text: msg.text,
        type: msg.type,
        status: msg.status,
        senderId: msg.senderId,
        conversationId: msg.conversationId,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          avatarUrl: msg.sender.avatarUrl,
        },
        createdAt: msg.createdAt,
      }));
    } catch (error: any) {
      logger.error('Get messages after error:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read by seq (all messages with seq <= given seq)
   */
  async markMessagesAsReadBySeq(
    userId: string,
    conversationId: string,
    seq: number
  ) {
    try {
      // Update user's read status
      await conversationService.updateUserReadStatus(userId, conversationId, seq);

      const result = await prisma.message.updateMany({
        where: {
          conversationId,
          seq: { lte: seq },
          senderId: { not: userId }, // Only mark messages from others
          status: { not: 'read' },
        },
        data: {
          status: 'read',
        },
      });

      logger.info(`Marked ${result.count} messages as read for user ${userId}, conversation ${conversationId}, up to seq ${seq}`);

      return { success: true, count: result.count };
    } catch (error: any) {
      logger.error('Mark messages as read by msgId error:', error);
      throw error;
    }
  }

  /**
   * Get session list with unread count for current user
   * KEY OPTIMIZATION: Uses UserConversationState table instead of scanning all messages
   */
  async getSessionList(userId: string) {
    try {
      const conversations = await conversationService.getConversationsWithUnread(userId);

      logger.info(`Get session list for user ${userId}: ${conversations.length} sessions`);

      // Format sessions for response
      return conversations.map(conv => ({
        conversationId: conv.conversationId,
        chatType: conv.type,
        name: conv.name,
        avatarUrl: conv.avatarUrl,
        unreadCount: conv.unreadCount,
        lastMessage: null, // Will be populated from messages if needed
      }));
    } catch (error: any) {
      logger.error('Get session list error:', error);
      throw error;
    }
  }

  /**
   * Sync messages for a conversation
   * Returns messages after afterSeq, ordered from old to new
   * Supports batch loading with afterSeq and limit parameters
   */
  async syncMessages(
    currentUserId: string,
    conversationId: string,
    chatType: string,
    afterSeq?: number,  // Optional: start from this seq (for batch loading)
    limit: number = 50
  ) {
    try {
      // Verify permission
      const isGroup = isGroupConversation(conversationId);

      if (isGroup) {
        const groupId = conversationId.replace('group_', '');
        const participant = await prisma.groupMember.findFirst({
          where: { groupId, userId: currentUserId },
        });
        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        const otherUserId = getOtherUserIdFromConversationId(conversationId, currentUserId);
        if (!otherUserId) {
          throw new Error('Invalid conversation ID');
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: currentUserId, userId2: otherUserId },
              { userId1: otherUserId, userId2: currentUserId },
            ],
          },
        });
        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      // Determine the starting seq
      // If afterSeq is provided, use it; otherwise get from UserConversationState
      logger.info(`[MessageService] Sync query: conversationId=${conversationId}, afterSeq=${afterSeq || 'null'}, limit=${limit}`);
      let startSeq = afterSeq;
      if (!startSeq) {
        const state = await prisma.userConversationState.findUnique({
          where: {
            userId_conversationId: {
              userId: currentUserId,
              conversationId,
            },
          },
        });
        startSeq = state?.lastReadSeq || undefined;
      }

      logger.info(`[MessageService] Sync query: conversationId=${conversationId}, startSeq=${startSeq || 'null'}, limit=${limit}`);

      // Build query: get messages after startSeq
      const where: any = {
        conversationId,
      };

      // Only add seq filter if startSeq exists
      if (startSeq) {
        where.seq = { gt: startSeq };
      }

      // Exclude messages sent by current user
      if (currentUserId) {
        where.senderId = { not: currentUserId };
      }

      const messages = await prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { seq: 'asc' },
        take: limit,
      });

      logger.info(`Sync ${messages.length} messages for user ${currentUserId}, conversation ${conversationId}`);

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        msgId: msg.msgId,
        seq: msg.seq,
        text: msg.text,
        type: msg.type,
        status: msg.status,
        senderId: msg.senderId,
        conversationId: msg.conversationId,
        sender: msg.sender ? {
          id: msg.sender.id,
          name: msg.sender.name,
          avatarUrl: msg.sender.avatarUrl,
        } : null,
        createdAt: msg.createdAt,
      }));

      // Determine if there are more messages
      const hasMore = messages.length >= limit;
      const latestSeq = messages.length > 0 ? messages[messages.length - 1].seq : 0;

      return {
        messages: formattedMessages,
        hasMore,
        latestSeq,
      };
    } catch (error: any) {
      logger.error('Sync messages error:', error);
      throw error;
    }
  }

  /**
   * Acknowledge messages and update lastReadSeq
   * Updates lastReadSeq and resets unread count to 0
   */
  async ackMessages(currentUserId: string, conversationId: string, minSeq: number) {
    try {
      logger.info(`[MessageService] Ack params: currentUserId=${currentUserId}, conversationId=${conversationId}, minSeq=${minSeq}`);

      // Update lastReadSeq and reset unread count
      await prisma.userConversationState.updateMany({
        where: {
          userId: currentUserId,
          conversationId: conversationId,
        },
        data: {
          lastReadSeq: minSeq,
          unreadCount: 0,
          updatedAt: new Date(),
        },
      });

      logger.info(`[MessageService] Updated lastReadSeq to ${minSeq} for user ${currentUserId}, conversation ${conversationId}`);

      return { success: true };
    } catch (error: any) {
      logger.error('Ack messages error:', error);
      throw error;
    }
  }

  /**
   * Sync messages with seq gap
   * Returns messages between fromSeq and toSeq (exclusive)
   */
  async syncSeqGap(
    conversationId: string,
    fromSeq: number,
    toSeq: number
  ) {
    try {
      logger.info(`[MessageService] Sync seq gap: conversationId=${conversationId}, fromSeq=${fromSeq}, toSeq=${toSeq}`);

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          seq: {
            gt: fromSeq,
            lt: toSeq,
          },
        },
        orderBy: { seq: 'asc' },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      logger.info(`[MessageService] Synced ${messages.length} messages for seq gap`);

      return messages.map(msg => ({
        id: msg.id,
        msgId: msg.msgId,
        seq: msg.seq,
        text: msg.text,
        type: msg.type,
        status: msg.status,
        senderId: msg.senderId,
        conversationId: msg.conversationId,
        sender: msg.sender ? {
          id: msg.sender.id,
          name: msg.sender.name,
          avatarUrl: msg.sender.avatarUrl,
        } : null,
        createdAt: msg.createdAt,
      }));
    } catch (error: any) {
      logger.error('Sync seq gap error:', error);
      throw error;
    }
  }

  /**
   * Get recent messages for AI context
   * Retrieves the most recent messages from a conversation for AI context
   */
  async getRecentMessagesForContext(userId: string, conversationId: string, limit: number = 20) {
    try {
      logger.info(`[MessageService] Getting recent messages for context: conversation ${conversationId}, user ${userId}, limit ${limit}`);

      // Verify user has access to this conversation
      const isGroup = isGroupConversation(conversationId);

      if (isGroup) {
        const groupId = conversationId.replace('group_', '');
        const participant = await prisma.groupMember.findFirst({
          where: { groupId, userId },
        });
        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        // For direct chat, verify friendship
        const otherUserId = getOtherUserIdFromConversationId(conversationId, userId);
        if (!otherUserId) {
          throw new Error('Invalid conversation ID');
        }

        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: otherUserId },
              { userId1: otherUserId, userId2: userId },
            ],
          },
        });
        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      // Get recent messages, ordered from newest to oldest (up to the limit)
      const messages = await prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      // Reverse the array to get chronological order (oldest first)
      const chronologicalMessages = messages.reverse();

      // Format for AI context, ensuring no null values
      const contextMessages = chronologicalMessages.map(msg => ({
        text: msg.text || '',
        senderId: msg.senderId || '',
        senderName: msg.sender?.name || undefined,
        isMe: msg.senderId === userId,
        timestamp: msg.createdAt ? msg.createdAt.getTime() : Date.now(),
      }));

      logger.info(`[MessageService] Retrieved ${contextMessages.length} messages for context`);

      return contextMessages;
    } catch (error: any) {
      logger.error('Get recent messages for context error:', error);
      throw error;
    }
  }

  /**
   * Get messages for translation (before and after the target message)
   */
  async getMessagesForTranslation(
    conversationId: string,
    msgId: string,  // This is msgId (frontend-generated ID)
    beforeCount: number = 5,
    afterCount: number = 2
  ) {
    try {
      logger.info(`[MessageService] Getting messages for translation: conversation ${conversationId}, msgId ${msgId}`);

      // Get the target message using msgId
      const targetMessage = await prisma.message.findFirst({
        where: { msgId: msgId },
        select: { createdAt: true },
      });

      if (!targetMessage) {
        logger.warn(`[MessageService] Target message not found: ${msgId}`);
        return { before: [], after: [] };
      }

      // Get messages before the target message
      const beforeMessages = await prisma.message.findMany({
        where: {
          conversationId,
          createdAt: { lt: targetMessage.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        take: beforeCount,
      });

      // Reverse to get chronological order
      const before = beforeMessages.reverse().map(msg => ({
        text: msg.text || '',
        senderId: msg.senderId || '',
        createdAt: msg.createdAt,
      }));

      // Get messages after the target message
      const afterMessages = await prisma.message.findMany({
        where: {
          conversationId,
          createdAt: { gt: targetMessage.createdAt },
        },
        orderBy: { createdAt: 'asc' },
        take: afterCount,
      });

      const after = afterMessages.map(msg => ({
        text: msg.text || '',
        senderId: msg.senderId || '',
        createdAt: msg.createdAt,
      }));

      logger.info(`[MessageService] Retrieved ${before.length} before and ${after.length} after messages for translation`);

      return { before, after };
    } catch (error: any) {
      logger.error('Get messages for translation error:', error);
      throw error;
    }
  }
}

export default new MessageService();
