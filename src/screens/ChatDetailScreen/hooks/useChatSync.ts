/**
 * useChatSync - 聊天数据同步逻辑
 * 
 * 负责：
 * - 同步群组成员信息
 * - 同步用户信息
 * - 同步会话信息
 * - 同步消息从服务器
 * - 消息确认 (ACK)
 */

import { useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { Database } from '@nozbe/watermelondb';
import { Message, Conversation, Friend, Group, GroupMember } from '../../../database/models';
import { WebSocketMessageData } from '../../../types/websocket';
import { API_CONFIG } from '../../../config/constants';
import { getAuthToken } from '../../../services/ApiService';
import { getConversationInfo } from '../../../api/conversations';
import { getUserInfo, getUsersBatch } from '../../../api/user';
import logger from '../../../utils/logger';

interface UseChatSyncParams {
  database: Database | null;
  conversationId: string;
  chatId: string;
  chatType: 'direct' | 'group';
}

export const useChatSync = ({ database, conversationId, chatId, chatType }: UseChatSyncParams) => {
  /**
   * 同步群组成员信息
   */
  const syncGroupMembers = useCallback(async (groupId: string, userIds: string[]) => {
    if (!database) return;

    try {
      logger.debug('useChatSync', 'Syncing group members for group:', groupId, 'userIds:', userIds);
      const users = await getUsersBatch(userIds);

      await database.write(async () => {
        for (const user of users) {
          const existingMembers = await database.collections
            .get<GroupMember>('group_members')
            .query(Q.and(
              Q.where('group_id', Q.eq(groupId)),
              Q.where('user_id', Q.eq(user.id))
            ))
            .fetch();

          if (existingMembers.length > 0) {
            await existingMembers[0].update((m: GroupMember) => {
              m.name = user.name;
              m.avatarUrl = user.avatarUrl || undefined;
              m.updatedAt = Date.now();
            });
            logger.debug('useChatSync', 'Updated group member:', user.id);
          } else {
            await database.collections.get<GroupMember>('group_members').create((m: GroupMember) => {
              m.groupId = groupId;
              m.userId = user.id;
              m.name = user.name;
              m.avatarUrl = user.avatarUrl || undefined;
              m.role = 'member';
              m.joinedAt = Date.now();
              m.createdAt = Date.now();
              m.updatedAt = Date.now();
            });
            logger.debug('useChatSync', 'Created group member:', user.id);
          }
        }
      });
      logger.debug('useChatSync', 'Group members synced:', userIds.length);
    } catch (error: any) {
      logger.error('useChatSync', 'Sync group members error:', error.message);
    }
  }, [database]);

  /**
   * 同步用户信息（用于单聊）
   */
  const syncUserInfo = useCallback(async (userId: string) => {
    if (!database) return;

    try {
      logger.debug('useChatSync', 'Syncing user info for:', userId);
      const userInfo = await getUserInfo(userId);

      await database.write(async () => {
        const existingFriends = await database.collections
          .get<Friend>('friends')
          .query(Q.where('friend_id', Q.eq(userId)))
          .fetch();

        if (existingFriends.length > 0) {
          await existingFriends[0].update((f: Friend) => {
            f.name = userInfo.name;
            f.avatarUrl = userInfo.avatarUrl || undefined;
            f.updatedAt = Date.now();
          });
          logger.debug('useChatSync', 'Updated friend info:', userId);
        } else {
          await database.collections.get<Friend>('friends').create((f: Friend) => {
            f.friendId = userId;
            f.name = userInfo.name;
            f.avatarUrl = userInfo.avatarUrl || undefined;
            f.createdAt = Date.now();
            f.updatedAt = Date.now();
          });
          logger.debug('useChatSync', 'Created friend info:', userId);
        }
      });
    } catch (error: any) {
      logger.error('useChatSync', 'Sync user info error:', error.message);
    }
  }, [database]);

  /**
   * 同步会话信息（更新好友/群组信息）
   */
  const syncConversationInfo = useCallback(async () => {
    try {
      logger.debug('useChatSync', 'Syncing conversation info:', conversationId);

      const info = await getConversationInfo(conversationId);
      logger.debug('useChatSync', 'Conversation info:', info);

      if (!database) {
        logger.warn('useChatSync', 'Database not available, skipping contact update');
        return;
      }

      await database.write(async () => {
        if (info.type === 'direct') {
          const existingFriends = await database.collections
            .get<Friend>('friends')
            .query(Q.where('friend_id', Q.eq(info.targetId)))
            .fetch();

          if (existingFriends.length > 0) {
            await existingFriends[0].update((f: Friend) => {
              f.name = info.name;
              f.avatarUrl = info.avatarUrl || undefined;
              f.updatedAt = Date.now();
            });
          } else {
            await database.collections.get<Friend>('friends').create((f: Friend) => {
              f.friendId = info.targetId;
              f.name = info.name;
              f.avatarUrl = info.avatarUrl || undefined;
              f.createdAt = Date.now();
              f.updatedAt = Date.now();
            });
          }
          logger.debug('useChatSync', 'Friend info synced:', info.targetId);
        } else {
          const existingGroups = await database.collections
            .get<Group>('groups')
            .query(Q.where('group_id', Q.eq(info.targetId)))
            .fetch();

          if (existingGroups.length > 0) {
            await existingGroups[0].update((g: Group) => {
              g.name = info.name;
              g.avatarUrl = info.avatarUrl || undefined;
              g.updatedAt = Date.now();
            });
          } else {
            await database.collections.get<Group>('groups').create((g: Group) => {
              g.groupId = info.targetId;
              g.name = info.name;
              g.avatarUrl = info.avatarUrl || undefined;
              g.ownerId = '';
              g.memberIds = '[]';
              g.createdAt = Date.now();
              g.updatedAt = Date.now();
            });
          }
          logger.debug('useChatSync', 'Group info synced:', info.targetId);
        }
      });
    } catch (error) {
      logger.error('useChatSync', 'Sync conversation info error:', error);
    }
  }, [database, conversationId]);

  /**
   * 消息确认（ACK）
   */
  const ackMessages = useCallback(async (minMsgId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        logger.warn('useChatSync', 'No token, skip ack');
        return;
      }

      logger.debug('useChatSync', 'Acking messages, minMsgId:', minMsgId);

      const response = await fetch(`${API_CONFIG.BASE_URL}/api/chats/messages/ack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          minMsgId,
        }),
      });

      const data: any = await response.json();

      if (response.ok && data.success) {
        logger.debug('useChatSync', 'Acked messages, minMsgId:', minMsgId);
      } else {
        logger.error('useChatSync', 'Ack failed:', data.error);
      }
    } catch (error: any) {
      logger.error('useChatSync', 'Ack error:', error.message);
    }
  }, [conversationId]);

  /**
   * 从服务器同步消息
   */
  const syncMessagesFromServer = useCallback(async () => {
    logger.debug('useChatSync', '=== syncMessagesFromServer START ===');
    try {
      const token = await getAuthToken();
      if (!token) {
        logger.warn('useChatSync', 'No token, skip sync');
        return;
      }

      // Step 1: 批量获取所有消息
      logger.debug('useChatSync', 'Step 1: Fetching all messages in batches');
      let hasMore = true;
      let afterMsgId: string | undefined = undefined;
      const batchSize = 1000;
      const allMessages: any[] = [];
      const allSenderIds = new Set<string>();

      while (hasMore) {
        const url = `${API_CONFIG.BASE_URL}/api/chats/messages/sync?` +
          `conversationId=${conversationId}&` +
          `chatType=${chatType}&` +
          `limit=${batchSize}` +
          (afterMsgId ? `&afterMsgId=${afterMsgId}` : '');

        logger.debug('useChatSync', 'Fetching batch, afterMsgId:', afterMsgId);

        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data: any = await response.json();

        if (!response.ok || !data.success) {
          logger.error('useChatSync', 'Failed to fetch messages:', data.error);
          hasMore = false;
          continue;
        }

        logger.debug('useChatSync', 'Batch fetched:', data.data.messages.length, 'messages, hasMore:', data.data.hasMore);

        if (data.data.messages.length > 0) {
          allMessages.push(...data.data.messages);
          data.data.messages.forEach((m: any) => {
            if (m.senderId) allSenderIds.add(m.senderId as string);
          });
          afterMsgId = data.data.latestMsgId;
          hasMore = data.data.hasMore;
        } else {
          hasMore = false;
        }
      }

      logger.debug('useChatSync', 'All messages fetched:', allMessages.length, 'total, senders:', allSenderIds.size);

      // Step 2: 群聊时同步群组成员
      if (chatType === 'group' && allSenderIds.size > 0) {
        const senderIdsArray = Array.from(allSenderIds);
        logger.debug('useChatSync', 'Step 2: Syncing group members, userIds:', senderIdsArray);
        await syncGroupMembers(chatId, senderIdsArray);
        logger.debug('useChatSync', 'Group members synced');
      }

      // Step 3: 保存消息到本地数据库
      if (allMessages.length > 0) {
        logger.debug('useChatSync', 'Step 3: Saving', allMessages.length, 'messages to local');
        await database!.write(async () => {
          for (const msg of allMessages) {
            try {
              const existing = await database!.collections
                .get<Message>('messages')
                .query(Q.where('msg_id', Q.eq(msg.msgId)))
                .fetch();

              if (existing.length === 0) {
                await database!.collections.get<Message>('messages').create((message: any) => {
                  message.msgId = msg.msgId;
                  message.conversationId = msg.conversationId || conversationId;
                  message.chatType = msg.chatType || 'direct';
                  message.targetId = msg.targetId;
                  message.text = msg.text;
                  message.senderId = msg.senderId;
                  message.chatSessionId = msg.senderId;
                  message.status = msg.status;
                  message.timestamp = new Date(msg.createdAt).getTime();
                });
                logger.debug('useChatSync', 'Saved message:', msg.msgId);
              } else {
                logger.debug('useChatSync', 'Message exists, skip:', msg.msgId);
              }
            } catch (e) {
              logger.debug('useChatSync', 'Save message error:', msg.msgId, e);
            }
          }
        });
        logger.debug('useChatSync', 'All messages saved');

        // Step 4: 确认消息
        const lastMsgId = allMessages[allMessages.length - 1]?.msgId;
        if (lastMsgId) {
          logger.debug('useChatSync', 'Step 4: Calling ackMessages with:', lastMsgId);
          await ackMessages(lastMsgId);

          // 清除本地未读数
          const conversations = await database!.collections
            .get<Conversation>('conversations')
            .query(Q.where('conversation_id', Q.eq(conversationId)))
            .fetch();

          if (conversations.length > 0) {
            await database!.write(async () => {
              await conversations[0].update((c: Conversation) => {
                c.unreadCount = 0;
                c.updatedAt = Date.now();
              });
            });
            logger.debug('useChatSync', 'Local unread count cleared');
          }

          logger.debug('useChatSync', 'ackMessages completed');
        }
      } else {
        logger.debug('useChatSync', 'No messages to sync');
      }
    } catch (error: any) {
      logger.error('useChatSync', 'Sync error:', error.message);
    } finally {
      logger.debug('useChatSync', '=== syncMessagesFromServer END ===');
    }
  }, [conversationId, chatType, chatId, database, ackMessages, syncGroupMembers]);

  return {
    syncGroupMembers,
    syncUserInfo,
    syncConversationInfo,
    syncMessagesFromServer,
    ackMessages,
  };
};
