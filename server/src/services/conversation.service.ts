import prisma from '../config/database';
import logger from '../utils/logger';
import {
  generateDirectConversationId,
  generateGroupConversationId,
  isGroupConversation,
  getOtherUserIdFromConversationId,
} from '../utils/conversationId';
import { ErrorCode, createError } from '../constants/errorCodes';

interface ConversationInfo {
  conversationId: string;
  type: 'direct' | 'group';
  targetId: string;
  name: string;
  avatarUrl?: string | null;
  latestSeq?: number | null;
  latestSummary?: string | null;
  latestSenderId?: string | null;
  latestTimestamp?: Date | null;
  unreadCount: number;
  lastReadSeq?: number | null;
}

class ConversationService {
  /**
   * 获取或创建单聊会话状态（不创建 Conversation 表记录）
   */
  async getOrCreateDirectConversationState(userId1: string, userId2: string) {
    try {
      const conversationId = generateDirectConversationId(userId1, userId2);
      const otherUserId = userId1 < userId2 ? userId2 : userId1;

      // 获取对方用户信息
      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      });

      if (!otherUser) {
        throw new Error('User not found');
      }

      // 获取或创建 UserConversationState
      const state = await prisma.userConversationState.upsert({
        where: {
          userId_conversationId: {
            userId: userId1,
            conversationId,
          },
        },
        update: {},
        create: {
          userId: userId1,
          conversationId,
          type: 'direct',
          targetId: otherUserId,
          unreadCount: 0,
        },
      });

      logger.info(`[ConversationService] Direct conversation state: ${conversationId}`);
      return {
        conversationId,
        type: 'direct' as const,
        targetId: otherUserId,
        name: otherUser.name,
        avatarUrl: otherUser.avatarUrl,
        state,
      };
    } catch (error: any) {
      logger.error('[ConversationService] getOrCreateDirectConversationState error:', error);
      throw error;
    }
  }

  /**
   * 获取或创建群聊会话（创建 Conversation 表记录和 UserConversationState）
   */
  async getOrCreateGroupConversationState(userId: string, groupId: string) {
    try {
      const conversationId = generateGroupConversationId(groupId);

      // 获取群信息
      const group = await prisma.group.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        throw new Error('Group not found');
      }

      // 获取或创建 Conversation 记录（仅群聊需要）
      let conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            id: conversationId,
            groupId,
            name: group.name,
            avatarUrl: group.avatarUrl,
          },
        });
        logger.info(`[ConversationService] Created conversation for group: ${conversationId}`);
      }

      // 获取或创建 UserConversationState
      const state = await prisma.userConversationState.upsert({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
        update: {},
        create: {
          userId,
          conversationId,
          type: 'group',
          targetId: groupId,
          unreadCount: 0,
          lastReadSeq: null, // Initialize as null, will be updated when user reads messages
        },
      });

      logger.info(`[ConversationService] Group conversation state: ${conversationId}`);
      return {
        conversationId,
        type: 'group' as const,
        targetId: groupId,
        name: group.name,
        avatarUrl: group.avatarUrl,
        state,
      };
    } catch (error: any) {
      logger.error('[ConversationService] getOrCreateGroupConversationState error:', error);
      throw error;
    }
  }

  /**
   * 获取会话详情（用于进入会话时同步信息）
   */
  async getConversationInfo(userId: string, conversationId: string): Promise<ConversationInfo> {
    try {
      const isGroup = isGroupConversation(conversationId);

      if (isGroup) {
        // 群聊：获取群信息并验证
        const groupId = conversationId.replace('group_', '');

        // 1. 先检查群是否存在
        const group = await prisma.group.findUnique({
          where: { id: groupId },
          select: { id: true, status: true, name: true, avatarUrl: true },
        });

        if (!group) {
          throw createError(ErrorCode.GROUP_NOT_FOUND);
        }

        // 2. 检查群是否已解散
        if (group.status === 'dissolved') {
          throw createError(ErrorCode.GROUP_DISSOLVED);
        }

        // 3. 最后检查成员身份
        const membership = await prisma.groupMember.findFirst({
          where: {
            groupId,
            userId,
          },
        });

        if (!membership) {
          throw createError(ErrorCode.NOT_GROUP_MEMBER);
        }

        // 获取或创建 UserConversationState
        const state = await this.getOrCreateGroupConversationState(userId, groupId);

        // Get the latest message seq from Conversation record
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            latestSeq: true,
            latestSummary: true,
            latestSenderId: true,
            latestTimestamp: true,
          },
        });

        return {
          conversationId,
          type: 'group',
          targetId: groupId,
          name: group.name,
          avatarUrl: group.avatarUrl,
          latestSeq: conversation?.latestSeq || undefined,
          latestSummary: conversation?.latestSummary || undefined,
          latestSenderId: conversation?.latestSenderId || undefined,
          latestTimestamp: conversation?.latestTimestamp || undefined,
          unreadCount: state.state.unreadCount,
          lastReadSeq: state.state.lastReadSeq,
        };
      } else {
        // 单聊：获取对方用户信息
        const otherUserId = getOtherUserIdFromConversationId(conversationId, userId);
        if (!otherUserId) {
          throw new Error('Invalid conversation ID');
        }

        const otherUser = await prisma.user.findUnique({
          where: { id: otherUserId },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        });

        if (!otherUser) {
          throw new Error('User not found');
        }

        // 获取或创建 UserConversationState
        const state = await this.getOrCreateDirectConversationState(userId, otherUserId);

        // 获取 Conversation 记录获取最新消息信息
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: {
            latestSeq: true,
            latestSummary: true,
            latestSenderId: true,
            latestTimestamp: true,
          },
        });

        return {
          conversationId,
          type: 'direct',
          targetId: otherUserId,
          name: otherUser.name,
          avatarUrl: otherUser.avatarUrl,
          latestSeq: conversation?.latestSeq || undefined,
          latestSummary: conversation?.latestSummary || undefined,
          latestSenderId: conversation?.latestSenderId || undefined,
          latestTimestamp: conversation?.latestTimestamp || undefined,
          unreadCount: state.state.unreadCount,
          lastReadSeq: state.state.lastReadSeq,
        };
      }
    } catch (error: any) {
      // 业务错误使用 info 级别，其他错误使用 error 级别
      const isBusinessError = error.code && [
        ErrorCode.GROUP_NOT_FOUND,
        ErrorCode.GROUP_DISSOLVED,
        ErrorCode.NOT_GROUP_MEMBER,
        ErrorCode.ACCESS_DENIED,
      ].includes(error.code);

      if (isBusinessError) {
        logger.info('[ConversationService] getConversationInfo error:', error.message, 'code:', error.code);
      } else {
        logger.error('[ConversationService] getConversationInfo error:', error);
      }
      throw error;
    }
  }

  /**
   * 获取有未读消息的会话列表
   */
  async getConversationsWithUnread(userId: string): Promise<ConversationInfo[]> {
    try {
      // 获取所有有未读消息的 UserConversationState
      const states = await prisma.userConversationState.findMany({
        where: {
          userId,
          unreadCount: { gt: 0 },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      logger.info(`[ConversationService] Got ${states.length} conversations with unread for user ${userId}`);

      // 为每个会话获取详细信息
      const conversations: ConversationInfo[] = [];
      for (const state of states) {
        try {
          const isGroup = isGroupConversation(state.conversationId);

          if (isGroup) {
            // 群聊：获取群信息和 Conversation 记录
            const groupId = state.conversationId.replace('group_', '');
            const [group, conversation] = await Promise.all([
              prisma.group.findUnique({
                where: { id: groupId },
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              }),
              prisma.conversation.findUnique({
                where: { id: state.conversationId },
                select: {
                  latestSeq: true,
                  latestSummary: true,
                  latestSenderId: true,
                  latestTimestamp: true,
                },
              }),
            ]);

            if (group) {
              conversations.push({
                conversationId: state.conversationId,
                type: 'group',
                targetId: groupId,
                name: group.name,
                avatarUrl: group.avatarUrl,
                unreadCount: state.unreadCount,
                lastReadSeq: state.lastReadSeq,
                latestSeq: conversation?.latestSeq || undefined,
                latestSummary: conversation?.latestSummary || undefined,
                latestSenderId: conversation?.latestSenderId || undefined,
                latestTimestamp: conversation?.latestTimestamp || undefined,
              });
            }
          } else {
            // 单聊：获取对方用户信息和 Conversation 记录
            const otherUserId = getOtherUserIdFromConversationId(state.conversationId, userId);
            if (otherUserId) {
              const [otherUser, conversation] = await Promise.all([
                prisma.user.findUnique({
                  where: { id: otherUserId },
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                }),
                prisma.conversation.findUnique({
                  where: { id: state.conversationId },
                  select: {
                    latestSeq: true,
                    latestSummary: true,
                    latestSenderId: true,
                    latestTimestamp: true,
                  },
                }),
              ]);

              if (otherUser) {
                conversations.push({
                  conversationId: state.conversationId,
                  type: 'direct',
                  targetId: otherUserId,
                  name: otherUser.name,
                  avatarUrl: otherUser.avatarUrl,
                  unreadCount: state.unreadCount,
                  lastReadSeq: state.lastReadSeq,
                  latestSeq: conversation?.latestSeq || undefined,
                  latestSummary: conversation?.latestSummary || undefined,
                  latestSenderId: conversation?.latestSenderId || undefined,
                  latestTimestamp: conversation?.latestTimestamp || undefined,
                });
              }
            }
          }
        } catch (error) {
          logger.error(`[ConversationService] Error processing conversation ${state.conversationId}:`, error);
        }
      }

      return conversations;
    } catch (error: any) {
      logger.error('[ConversationService] getConversationsWithUnread error:', error);
      throw error;
    }
  }

  /**
   * 更新会话状态（收到新消息时调用）
   */
  async updateConversationState(
    conversationId: string,
    seq: number,
    summary: string,
    senderId: string,
    timestamp: Date
  ) {
    try {
      const isGroup = isGroupConversation(conversationId);

      // 更新 Conversation 记录（单聊和群聊都更新）
      await prisma.conversation.upsert({
        where: { id: conversationId },
        update: {
          latestSeq: seq,
          latestSummary: summary,
          latestSenderId: senderId,
          latestTimestamp: timestamp,
        },
        create: {
          id: conversationId,
          groupId: isGroup ? conversationId.replace('group_', '') : '',
          latestSeq: seq,
          latestSummary: summary,
          latestSenderId: senderId,
          latestTimestamp: timestamp,
        },
      });

      logger.info(`[ConversationService] Updated conversation state: ${conversationId}`);
    } catch (error: any) {
      logger.error('[ConversationService] updateConversationState error:', error);
      throw error;
    }
  }

  /**
   * 更新用户读状态
   */
  async updateUserReadStatus(
    userId: string,
    conversationId: string,
    lastReadSeq: number
  ) {
    logger.info(`[ConversationService] updateUserReadStatus: userId=${userId}, conversationId=${conversationId}, lastReadSeq=${lastReadSeq}`);
    try {
      await prisma.userConversationState.upsert({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
        update: {
          lastReadSeq,
          unreadCount: 0,
        },
        create: {
          userId,
          conversationId,
          type: isGroupConversation(conversationId) ? 'group' : 'direct',
          targetId: isGroupConversation(conversationId)
            ? conversationId.replace('group_', '')
            : getOtherUserIdFromConversationId(conversationId, userId) || '',
          lastReadSeq,
          unreadCount: 0,
        },
      });

      logger.info(`[ConversationService] Updated read status: userId=${userId}, conversationId=${conversationId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('[ConversationService] updateUserReadStatus error:', error);
      throw error;
    }
  }

  /**
   * 增加未读计数
   */
  async incrementUnreadCount(userId: string, conversationId: string) {
    try {
      const isGroup = isGroupConversation(conversationId);

      await prisma.userConversationState.upsert({
        where: {
          userId_conversationId: {
            userId,
            conversationId,
          },
        },
        update: {
          unreadCount: {
            increment: 1,
          },
        },
        create: {
          userId,
          conversationId,
          type: isGroup ? 'group' : 'direct',
          targetId: isGroup
            ? conversationId.replace('group_', '')
            : getOtherUserIdFromConversationId(conversationId, userId) || '',
          unreadCount: 1,
        },
      });

      logger.info(`[ConversationService] Incremented unread count: userId=${userId}, conversationId=${conversationId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('[ConversationService] incrementUnreadCount error:', error);
      throw error;
    }
  }
}

export default new ConversationService();
