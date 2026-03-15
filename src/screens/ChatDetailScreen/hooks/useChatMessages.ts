/**
 * useChatMessages - 消息状态管理
 *
 * 负责：
 * - 消息状态管理
 * - 数据库订阅监听
 * - 消息格式化
 * - WebSocket 消息处理
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Q } from '@nozbe/watermelondb';
import { Database } from '@nozbe/watermelondb';
import { Message, Friend, GroupMember } from '../../../database/models';
import { MessageInterface } from '../types';
import logger from '../../../utils/logger';
import { EventBus, WebSocketMessageData, WebSocketMessageSentData } from '../../../events/EventBus';

interface UseChatMessagesParams {
  database: Database | null;
  conversationId: string;
  chatId: string;
  chatType: 'direct' | 'group';
  user: { id: string; avatarUrl?: string } | null;
  syncMessagesFromServer: () => Promise<void>;
  syncConversationInfo: () => Promise<void>;
  syncUserInfo: (userId: string) => Promise<void>;
}

export const useChatMessages = ({
  database,
  conversationId,
  chatId,
  chatType,
  user,
  syncMessagesFromServer,
  syncConversationInfo,
  syncUserInfo,
}: UseChatMessagesParams) => {
  const [messages, setMessages] = useState<MessageInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestSeq, setLatestSeq] = useState<number>(0);

  // 存储好友头像的 ref
  const friendAvatarsRef = useRef<Map<string, string>>(new Map());

  // 超时定时器管理
  const sendingTimeouts = useRef<Map<string, any>>(new Map());

  /**
   * 获取本地最新 seq（异步版本）
   */
  const getLocalLatestSeq = useCallback(async (): Promise<number | undefined> => {
    if (!database) return undefined;

    try {
      // 从 messages 表获取最新 seq
      const latestMessages = await database.collections
        .get<Message>('messages')
        .query(
          Q.where('conversation_id', Q.eq(conversationId)),
          Q.sortBy('timestamp', Q.desc),
          Q.take(1)
        ).fetch();

      if (latestMessages && latestMessages.length > 0) {
        return latestMessages[0].seq;
      }
      return undefined;
    } catch (error) {
      logger.error('useChatMessages', 'Get local latest seq error:', error);
      return undefined;
    }
  }, [database, conversationId]);

  /**
   * 处理消息发送确认（WebSocket message_sent 事件）
   */
  const handleMessageSent = useCallback((data: WebSocketMessageSentData) => {
    logger.debug('useChatMessages', 'Received message_sent event:', JSON.stringify(data));

    const updateLocalMessage = async () => {
      try {
        if (!database || !data.msgId) {
          logger.warn('useChatMessages', 'No database or msgId, skipping update');
          return;
        }

        // 更新本地消息的 seq 和 status
        const messages = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(data.msgId)))
          .fetch();

        logger.debug('useChatMessages', 'Found', messages.length, 'local messages with msgId:', data.msgId);

        if (messages.length > 0) {
          await database.write(async () => {
            await messages[0].update((m: Message) => {
              m.status = 'sent';
              if (data.seq !== undefined) {
                m.seq = data.seq;
              }
            });

            // 更新会话的最新消息
            const conversations = await database.collections
              .get<Message>('conversations')
              .query(Q.where('conversation_id', Q.eq(conversationId)))
              .fetch();

            if (conversations.length > 0) {
              await conversations[0].update((c: any) => {
                c.latestSummary = messages[0].text;
                c.latestSenderId = data.senderId || 'unknown';
                c.updatedAt = Date.now();
              });
            }
          });

          // 更新 UI 状态（包括 seq）
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.msgId === data.msgId
                ? { ...msg, sending: false, seq: data.seq }
                : msg
            )
          );
          logger.debug('useChatMessages', 'UI state updated');

          // 清除发送超时
          if (data.msgId && sendingTimeouts.current.has(data.msgId)) {
            const timeout = sendingTimeouts.current.get(data.msgId);
            if (timeout) {
              clearTimeout(timeout);
              sendingTimeouts.current.delete(data.msgId);
            }
          }
        }
      } catch (error) {
        logger.error('useChatMessages', 'Update local message error:', error);
      }
    };

    updateLocalMessage();
  }, [database, conversationId]);

  /**
   * 从数据库加载消息
   */
  const loadMessagesFromDatabase = useCallback(async () => {
    if (!database) return;

    try {
      const dbMessages = await database.collections
        .get<Message>('messages')
        .query(
          Q.where('conversation_id', Q.eq(conversationId)),
          Q.sortBy('timestamp', Q.desc)
        )
        .fetch();

      logger.debug('useChatMessages', 'Fetched', dbMessages.length, 'messages');

      // 检查并更新超时的 sending 状态消息
      const now = Date.now();
      const timeoutThreshold = 30000; // 30 秒超时阈值（比发送超时稍长，留有余量）
      const timedOutMessages = dbMessages.filter(
        msg => msg.status === 'sending' && (now - msg.timestamp) > timeoutThreshold
      );

      if (timedOutMessages.length > 0) {
        logger.info('useChatMessages', 'Found', timedOutMessages.length, 'timed out sending messages, marking as failed');
        await database.write(async () => {
          for (const msg of timedOutMessages) {
            await msg.update((m: Message) => {
              m.status = 'failed';
              m.updatedAt = now;
            });
          }
        });
      }

      // 重新获取更新后的消息（如果有的话）
      const finalMessages = timedOutMessages.length > 0
        ? await database.collections
            .get<Message>('messages')
            .query(
              Q.where('conversation_id', Q.eq(conversationId)),
              Q.sortBy('timestamp', Q.desc)
            )
            .fetch()
        : dbMessages;

      // 获取所有发送者 ID
      const senderIds = [...new Set(finalMessages.map(m => m.senderId).filter(Boolean))];
      logger.debug('useChatMessages', 'Unique senderIds:', senderIds);

      // 查询头像信息
      let friendAvatars: Map<string, string> = new Map();
      if (senderIds.length > 0 && chatType === 'direct') {
        const otherUserId = senderIds.find(id => id !== user?.id);
        if (otherUserId) {
          const friends = await database.collections
            .get<Friend>('friends')
            .query(Q.where('friend_id', Q.eq(otherUserId)))
            .fetch();

          friends.forEach(f => {
            friendAvatars.set(f.friendId, f.avatarUrl || '');
          });
        }
      } else if (senderIds.length > 0 && chatType === 'group') {
        const groupMembers = await database.collections
          .get<GroupMember>('group_members')
          .query(Q.where('group_id', Q.eq(chatId)))
          .fetch();

        groupMembers.forEach(m => {
          friendAvatars.set(m.userId, m.avatarUrl || '');
        });

        if (user?.id) {
          friendAvatars.set(user.id, user.avatarUrl || '');
        }
      }

      // 存储到 ref
      friendAvatarsRef.current = friendAvatars;

      // 格式化为 UI 数据
      const formattedMessages = finalMessages.map(msg => {
        const isMe = msg.senderId === user?.id;
        const sender: 'me' | 'other' = isMe ? 'me' : 'other';
        const senderAvatar = isMe ? user?.avatarUrl : (friendAvatars.get(msg.senderId) || '');

        return {
          id: msg.id,
          msgId: msg.msgId,
          text: msg.text,
          sender,
          senderId: msg.senderId,
          senderAvatar,
          timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sending: msg.status === 'sending',
          failed: msg.status === 'failed',
          seq: msg.seq,
        };
      });

      setMessages(formattedMessages);
    } catch (error) {
      logger.error('useChatMessages', 'Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [database, conversationId, chatId, chatType, user]);

  /**
   * 设置数据库订阅和 WebSocket 监听
   */
  useEffect(() => {
    if (!database) return;

    // 加载消息
    loadMessagesFromDatabase();

    // 数据库订阅
    const subscription = database.collections
      .get<Message>('messages')
      .query(
        Q.where('conversation_id', Q.eq(conversationId)),
        Q.sortBy('timestamp', Q.desc)
      )
      .observe()
      .subscribe(async (dbMessages) => {
        logger.debug('useChatMessages', 'Database subscription triggered:', dbMessages.length, 'messages');

        // 群聊时重新获取群组成员头像
        if (chatType === 'group') {
          const groupMembers = await database.collections
            .get<GroupMember>('group_members')
            .query(Q.where('group_id', Q.eq(chatId)))
            .fetch();

          friendAvatarsRef.current.clear();
          groupMembers.forEach(m => {
            friendAvatarsRef.current.set(m.userId, m.avatarUrl || '');
          });

          if (user?.id) {
            friendAvatarsRef.current.set(user.id, user.avatarUrl || '');
          }
        }

        // 格式化消息
        const formattedMessages = dbMessages.map(msg => {
          const isMe = msg.senderId === user?.id;
          const sender: 'me' | 'other' = isMe ? 'me' : 'other';
          const senderAvatar = isMe
            ? user?.avatarUrl
            : (friendAvatarsRef.current.get(msg.senderId) || '');

          return {
            id: msg.id,
            msgId: msg.msgId,
            text: msg.text,
            sender,
            senderId: msg.senderId,
            senderAvatar,
            timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sending: msg.status === 'sending',
            failed: msg.status === 'failed',
            seq: msg.seq,
          };
        });

        setMessages(formattedMessages);
      });

    // 通过 EventBus 监听 WebSocket 消息
    const unsubscribeMessage = EventBus.on('ws:message', async (data) => {
      logger.info('useChatMessages', 'Received message from WebSocket:', data);

      // Note: MessageService already handles saving messages globally
      // We don't need to save here - the database observer will update UI when MessageService saves

      if (data.seq && data.seq > latestSeq) {
        setLatestSeq(data.seq);
      }
    });

    // 通过 EventBus 监听 message_sent 事件
    const unsubscribeMessageSent = EventBus.on('ws:message_sent', handleMessageSent);

    // 同步服务器消息
    syncMessagesFromServer();

    // 单聊时同步用户信息
    if (chatType === 'direct') {
      syncUserInfo(chatId);
    }

    // 同步会话信息
    syncConversationInfo();

    // 清理函数
    return () => {
      subscription.unsubscribe();
      unsubscribeMessage();
      unsubscribeMessageSent();

      // 清除所有超时定时器
      sendingTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      sendingTimeouts.current.clear();
    };
  }, [
    database,
    conversationId,
    chatId,
    chatType,
    user,
    syncMessagesFromServer,
    syncConversationInfo,
    syncUserInfo,
    loadMessagesFromDatabase,
    handleMessageSent,
  ]);

  return {
    messages,
    setMessages,
    loading,
    latestSeq,
    sendingTimeouts,
  };
};
