import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import logger from '../utils/logger';
import { PaginationParams } from '../types';

class MessageService {
  /**
   * Send a message
   */
  async sendMessage(
    targetId: string,
    senderId: string,
    text: string,
    type: 'text' | 'image' | 'file' = 'text',
    msgId?: string,
    chatType: 'direct' | 'group' = 'direct'
  ) {
    try {
      logger.info(`[MessageService] sendMessage: targetId=${targetId}, senderId=${senderId}, msgId=${msgId}, chatType=${chatType}`);

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
            chatType: existingMessage.chatType,
            targetId: existingMessage.targetId,
            sender: {
              id: existingMessage.senderId,
              name: 'Sender',
              avatarUrl: null,
            },
            createdAt: existingMessage.createdAt,
          };
        }
      }

      // 根据聊天类型进行权限检查
      if (chatType === 'group') {
        // 群聊：检查用户是否是群成员
        const participant = await prisma.chatParticipant.findFirst({
          where: {
            chatSessionId: targetId,
            userId: senderId,
          },
        });

        if (!participant) {
          logger.error(`[MessageService] Access denied: user ${senderId} is not member of group ${targetId}`);
          throw new Error('Access denied');
        }

        logger.info(`[MessageService] Group chat permission check passed`);
      } else {
        // 私聊：检查发送者和接收者是否是好友
        // targetId = receiverId (消息接收者)
        // senderId = 当前用户 (消息发送者)
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: senderId, userId2: targetId },
              { userId1: targetId, userId2: senderId },
            ],
          },
        });

        logger.info(`[MessageService] Friendship check result:`, friendship ? 'found' : 'not found');
        if (friendship) {
          logger.info(`[MessageService] Friendship: userId1=${friendship.userId1}, userId2=${friendship.userId2}`);
        }

        if (!friendship) {
          logger.error(`[MessageService] Access denied: user ${senderId} (sender) and ${targetId} (receiver) are not friends`);
          throw new Error('Access denied');
        }

        logger.info(`[MessageService] Direct chat permission check passed`);
      }

      // Create message - 存储原始的 targetId
      const message = await prisma.message.create({
        data: {
          id: uuidv4(),
          msgId,
          chatType,
          targetId, // 保存前端传递的 targetId（用户 ID 或群 ID）
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

      logger.info(`[MessageService] Message created: ${message.id}`);
      logger.info(`Message sent: ${message.id}`);

      return {
        id: message.id,
        msgId: message.msgId,
        text: message.text,
        type: message.type,
        status: message.status,
        senderId: message.senderId,
        chatType: message.chatType,
        targetId: message.targetId,
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          avatarUrl: message.sender.avatarUrl,
        },
        createdAt: message.createdAt,
      };
    } catch (error: any) {
      logger.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Get messages for a chat session
   */
  async getMessages(
    targetId: string,
    userId: string,
    params: PaginationParams = {},
    chatType: 'direct' | 'group' = 'direct'
  ) {
    try {
      const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = params;

      // 根据聊天类型进行权限检查
      if (chatType === 'group') {
        const participant = await prisma.chatParticipant.findFirst({
          where: {
            chatSessionId: targetId,
            userId,
          },
        });

        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        // 私聊：检查好友关系
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: targetId },
              { userId1: targetId, userId2: userId },
            ],
          },
        });

        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      const skip = (page - 1) * limit;

      const messages = await prisma.message.findMany({
        where: { targetId },
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
        where: { targetId },
      });

      return {
        data: messages.map((msg) => ({
          id: msg.id,
          msgId: msg.msgId,
          text: msg.text,
          type: msg.type,
          status: msg.status,
          senderId: msg.senderId,
          chatType: msg.chatType,
          targetId: msg.targetId,
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
   * Mark messages as read
   */
  async markMessagesAsRead(
    targetId: string,
    userId: string,
    chatType: 'direct' | 'group' = 'direct'
  ) {
    try {
      // 根据聊天类型进行权限检查
      if (chatType === 'group') {
        const participant = await prisma.chatParticipant.findFirst({
          where: {
            chatSessionId: targetId,
            userId,
          },
        });

        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        // 私聊：检查好友关系
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: targetId },
              { userId1: targetId, userId2: userId },
            ],
          },
        });

        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      // Update all unread messages from other users as read
      const result = await prisma.message.updateMany({
        where: {
          targetId,
          senderId: {
            not: userId,
          },
          status: {
            not: 'read',
          },
        },
        data: {
          status: 'read',
        },
      });

      logger.info(`Messages marked as read: ${targetId} by user ${userId}`);

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
    targetId: string,
    msgId?: string
  ) {
    try {
      // Verify permission (friend or group member)
      const isGroupChat = targetId.includes('group_');
      
      if (isGroupChat) {
        const participant = await prisma.chatParticipant.findFirst({
          where: { chatSessionId: targetId, userId },
        });
        if (!participant) {
          throw new Error('Access denied');
        }
      } else {
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { userId1: userId, userId2: targetId },
              { userId1: targetId, userId2: userId },
            ],
          },
        });
        if (!friendship) {
          throw new Error('Access denied');
        }
      }

      // Build query
      const where: any = { targetId };
      
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

      logger.info(`Get messages after ${msgId || 'start'} for target ${targetId}: ${messages.length} messages`);

      return messages.map(msg => ({
        id: msg.id,
        msgId: msg.msgId,
        text: msg.text,
        type: msg.type,
        status: msg.status,
        senderId: msg.senderId,
        targetId: msg.targetId,
        chatType: msg.chatType,
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
   * Mark messages as read by msgId (all messages with msgId <= given msgId)
   */
  async markMessagesAsReadByMsgId(
    userId: string,
    targetId: string,
    msgId: string
  ) {
    try {
      const result = await prisma.message.updateMany({
        where: {
          targetId,
          msgId: { lte: msgId },
          senderId: { not: userId }, // Only mark messages from others
          status: { not: 'read' },
        },
        data: {
          status: 'read',
        },
      });

      logger.info(`Marked ${result.count} messages as read for user ${userId}, target ${targetId}, up to msgId ${msgId}`);

      return { success: true, count: result.count };
    } catch (error: any) {
      logger.error('Mark messages as read by msgId error:', error);
      throw error;
    }
  }

  /**
   * Get session list with unread count for current user
   */
  async getSessionList(userId: string) {
    try {
      // Get all messages for this user (targetId = userId)
      const messages = await prisma.message.findMany({
        where: {
          targetId: userId,
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
        orderBy: { createdAt: 'desc' },
      });

      logger.info(`Get session list for user ${userId}: ${messages.length} messages`);

      // Group by senderId to get sessions
      const sessionMap = new Map();

      for (const msg of messages) {
        const key = `${msg.senderId}_${msg.chatType}`;

        if (!sessionMap.has(key)) {
          sessionMap.set(key, {
            targetId: msg.senderId,
            chatType: msg.chatType,
            senderName: msg.sender.name, // Store sender name
            senderAvatar: msg.sender.avatarUrl,
            messages: [],
            unreadCount: 0,
          });
        }

        const session = sessionMap.get(key);
        session.messages.push(msg);
        session.unreadCount++;
      }

      // Convert to array and format
      const sessions = Array.from(sessionMap.values()).map(session => {
        const lastMessage = session.messages[0]; // Latest message
        return {
          targetId: session.targetId,
          chatType: session.chatType,
          name: session.senderName, // Use sender name for direct chat
          avatarUrl: session.senderAvatar,
          unreadCount: session.unreadCount,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            msgId: lastMessage.msgId,
            text: lastMessage.text,
            senderId: lastMessage.senderId,
            timestamp: lastMessage.createdAt,
          } : null,
        };
      });

      logger.info(`Get session list for user ${userId}: ${sessions.length} sessions`);

      return sessions;
    } catch (error: any) {
      logger.error('Get session list error:', error);
      throw error;
    }
  }

  /**
   * Sync messages for a session
   * Returns up to `limit` messages, ordered from new to old
   * For direct chat: query messages FROM otherUserId TO currentUserId
   */
  async syncMessages(currentUserId: string, otherUserId: string, chatType: string, limit: number = 50) {
    try {
      let where: any = {};
      
      if (chatType === 'direct') {
        // For direct chat, get messages FROM other user TO current user
        // targetId = currentUserId (message recipient)
        // senderId = otherUserId (message sender)
        where = {
          targetId: currentUserId,
          senderId: otherUserId,
        };
      } else {
        // For group chat, get all messages for the group
        where = {
          targetId: otherUserId,
        };
      }

      logger.info(`[MessageService] Sync query:`, JSON.stringify(where));
      logger.info(`[MessageService] Sync params: currentUserId=${currentUserId}, otherUserId=${otherUserId}, chatType=${chatType}`);

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
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      logger.info(`Sync ${messages.length} messages for user ${currentUserId}, from ${otherUserId}`);

      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        msgId: msg.msgId,
        text: msg.text,
        type: msg.type,
        status: msg.status,
        senderId: msg.senderId,
        targetId: msg.targetId,
        chatType: msg.chatType,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          avatarUrl: msg.sender.avatarUrl,
        },
        createdAt: msg.createdAt,
      }));

      // Get minMsgId (oldest message in this batch)
      const minMsgId = messages.length > 0 ? messages[messages.length - 1].msgId : null;
      const hasMore = messages.length >= limit;

      return {
        messages: formattedMessages,
        minMsgId,
        hasMore,
      };
    } catch (error: any) {
      logger.error('Sync messages error:', error);
      throw error;
    }
  }

  /**
   * Acknowledge and delete messages up to minMsgId
   * Deletes messages with msgId >= minMsgId (already synced messages)
   * For direct chat: delete messages FROM otherUserId TO currentUserId
   */
  async ackMessages(currentUserId: string, otherUserId: string, minMsgId: string) {
    try {
      let where: any = {
        msgId: { gte: minMsgId },
      };
      
      if (otherUserId.includes('group_')) {
        // Group chat
        where.targetId = otherUserId;
      } else {
        // Direct chat: delete messages FROM other user TO current user
        // targetId = currentUserId (message recipient)
        // senderId = otherUserId (message sender)
        where.targetId = currentUserId;
        where.senderId = otherUserId;
      }

      logger.info(`[MessageService] Ack delete query:`, JSON.stringify(where));
      logger.info(`[MessageService] Ack params: currentUserId=${currentUserId}, otherUserId=${otherUserId}, minMsgId=${minMsgId}`);

      const result = await prisma.message.deleteMany({
        where,
      });

      logger.info(`Acked ${result.count} messages for user ${currentUserId}, from ${otherUserId}, minMsgId: ${minMsgId}`);

      return { success: true, count: result.count };
    } catch (error: any) {
      logger.error('Ack messages error:', error);
      throw error;
    }
  }
}

export default new MessageService();
