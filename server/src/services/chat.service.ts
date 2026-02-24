import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import logger from '../utils/logger';
import { PaginationParams } from '../types';

class ChatService {
  /**
   * Create a new chat session
   */
  async createChatSession(
    userId: string,
    participantIds: string[],
    name?: string,
    type: 'direct' | 'group' = 'direct'
  ) {
    try {
      // For direct chat, check if session already exists
      if (type === 'direct' && participantIds.length === 1) {
        const existingSession = await this.findDirectChatSession(userId, participantIds[0]);
        if (existingSession) {
          return existingSession;
        }
      }

      // Create chat session
      const session = await prisma.chatSession.create({
        data: {
          id: uuidv4(),
          name,
          type,
          participants: {
            create: [
              {
                userId,
                role: 'admin',
              },
              ...participantIds.map((participantId) => ({
                userId: participantId,
                role: 'member' as const,
              })),
            ],
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      logger.info(`Chat session created: ${session.id}`);

      return this.formatChatSession(session);
    } catch (error: any) {
      logger.error('Create chat session error:', error);
      throw error;
    }
  }

  /**
   * Get user's chat sessions
   */
  async getUserChatSessions(userId: string, params: PaginationParams = {}) {
    try {
      const { page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc' } = params;

      const skip = (page - 1) * limit;

      const sessions = await prisma.chatSession.findMany({
        where: {
          participants: {
            some: {
              userId,
            },
          },
        },
        include: {
          participants: {
            where: {
              userId: {
                not: userId,
              },
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  isOnline: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      });

      const total = await prisma.chatSession.count({
        where: {
          participants: {
            some: {
              userId,
            },
          },
        },
      });

      return {
        data: sessions.map((session) => this.formatChatSession(session, userId)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error('Get chat sessions error:', error);
      throw error;
    }
  }

  /**
   * Get chat session details
   */
  async getChatSession(sessionId: string, userId: string) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  isOnline: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        throw new Error('Chat session not found');
      }

      // Check if user is a participant
      const isParticipant = session.participants.some((p) => p.userId === userId);
      if (!isParticipant) {
        throw new Error('Access denied');
      }

      return this.formatChatSession(session, userId);
    } catch (error: any) {
      logger.error('Get chat session error:', error);
      throw error;
    }
  }

  /**
   * Update chat session
   */
  async updateChatSession(
    sessionId: string,
    userId: string,
    data: { name?: string; avatarUrl?: string }
  ) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });

      if (!session) {
        throw new Error('Chat session not found');
      }

      // Check if user is admin
      const participant = session.participants.find((p) => p.userId === userId);
      if (!participant || participant.role !== 'admin') {
        throw new Error('Access denied');
      }

      const updatedSession = await prisma.chatSession.update({
        where: { id: sessionId },
        data,
      });

      logger.info(`Chat session updated: ${sessionId}`);

      return updatedSession;
    } catch (error: any) {
      logger.error('Update chat session error:', error);
      throw error;
    }
  }

  /**
   * Delete chat session
   */
  async deleteChatSession(sessionId: string, userId: string) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });

      if (!session) {
        throw new Error('Chat session not found');
      }

      // Check if user is admin
      const participant = session.participants.find((p) => p.userId === userId);
      if (!participant || participant.role !== 'admin') {
        throw new Error('Access denied');
      }

      await prisma.chatSession.delete({
        where: { id: sessionId },
      });

      logger.info(`Chat session deleted: ${sessionId}`);

      return { success: true };
    } catch (error: any) {
      logger.error('Delete chat session error:', error);
      throw error;
    }
  }

  /**
   * Mark chat as read
   */
  async markChatAsRead(sessionId: string, userId: string) {
    try {
      await prisma.chatParticipant.updateMany({
        where: {
          chatSessionId: sessionId,
          userId,
        },
        data: {
          lastReadAt: new Date(),
        },
      });

      logger.info(`Chat marked as read: ${sessionId} by user ${userId}`);

      return { success: true };
    } catch (error: any) {
      logger.error('Mark chat as read error:', error);
      throw error;
    }
  }

  /**
   * Find existing direct chat session
   */
  private async findDirectChatSession(userId1: string, userId2: string) {
    const sessions = await prisma.chatSession.findMany({
      where: {
        type: 'direct',
        participants: {
          every: {
            userId: {
              in: [userId1, userId2],
            },
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return sessions.length > 0
      ? this.formatChatSession(sessions[0], userId1)
      : null;
  }

  /**
   * Format chat session data
   */
  private formatChatSession(session: any, currentUserId?: string) {
    const otherParticipants = session.participants.filter(
      (p: any) => p.userId !== currentUserId
    );

    return {
      id: session.id,
      name: session.name || otherParticipants[0]?.user.name || 'Unknown',
      type: session.type,
      avatarUrl:
        session.avatarUrl ||
        otherParticipants[0]?.user.avatarUrl ||
        null,
      participants: session.participants.map((p: any) => ({
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        avatarUrl: p.user.avatarUrl,
        isOnline: p.user.isOnline,
        role: p.role,
        lastReadAt: p.lastReadAt,
      })),
      lastMessage: session.messages[0]
        ? {
            id: session.messages[0].id,
            text: session.messages[0].text,
            senderId: session.messages[0].senderId,
            createdAt: session.messages[0].createdAt,
          }
        : null,
      unreadCount: 0, // Calculate based on messages and lastReadAt
      updatedAt: session.updatedAt,
    };
  }
}

export default new ChatService();
