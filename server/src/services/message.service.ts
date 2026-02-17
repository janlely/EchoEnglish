import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import logger from '../utils/logger';
import { PaginationParams } from '../types';

class MessageService {
  /**
   * Send a message
   */
  async sendMessage(
    chatSessionId: string,
    senderId: string,
    text: string,
    type: 'text' | 'image' | 'file' = 'text'
  ) {
    try {
      // Verify user is a participant
      const participant = await prisma.chatParticipant.findFirst({
        where: {
          chatSessionId,
          userId: senderId,
        },
      });

      if (!participant) {
        throw new Error('Access denied');
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          id: uuidv4(),
          text,
          type,
          senderId,
          chatSessionId,
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

      // Update chat session updated time
      await prisma.chatSession.update({
        where: { id: chatSessionId },
        data: {
          updatedAt: new Date(),
        },
      });

      logger.info(`Message sent: ${message.id}`);

      return {
        id: message.id,
        text: message.text,
        type: message.type,
        status: message.status,
        senderId: message.senderId,
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          avatarUrl: message.sender.avatarUrl,
        },
        chatSessionId: message.chatSessionId,
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
    chatSessionId: string,
    userId: string,
    params: PaginationParams = {}
  ) {
    try {
      const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = params;

      // Verify user is a participant
      const participant = await prisma.chatParticipant.findFirst({
        where: {
          chatSessionId,
          userId,
        },
      });

      if (!participant) {
        throw new Error('Access denied');
      }

      const skip = (page - 1) * limit;

      const messages = await prisma.message.findMany({
        where: { chatSessionId },
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
        where: { chatSessionId },
      });

      return {
        data: messages.map((msg) => ({
          id: msg.id,
          text: msg.text,
          type: msg.type,
          status: msg.status,
          senderId: msg.senderId,
          sender: {
            id: msg.sender.id,
            name: msg.sender.name,
            avatarUrl: msg.sender.avatarUrl,
          },
          chatSessionId: msg.chatSessionId,
          createdAt: msg.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
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
  async markMessagesAsRead(chatSessionId: string, userId: string) {
    try {
      // Update all unread messages from other users as read
      const result = await prisma.message.updateMany({
        where: {
          chatSessionId,
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

      // Update participant's last read time
      await prisma.chatParticipant.updateMany({
        where: {
          chatSessionId,
          userId,
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      logger.info(`Messages marked as read: ${chatSessionId} by user ${userId}`);

      return { success: true, count: result.count };
    } catch (error: any) {
      logger.error('Mark messages as read error:', error);
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
        throw new Error('Access denied');
      }

      const updatedMessage = await prisma.message.update({
        where: { id: messageId },
        data: { text },
      });

      logger.info(`Message updated: ${messageId}`);

      return updatedMessage;
    } catch (error: any) {
      logger.error('Update message error:', error);
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
        throw new Error('Access denied');
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
}

export default new MessageService();
