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
import { WebSocketMessageData } from '../../../types/websocket';
import { MessageInterface } from '../types';
import logger from '../../../utils/logger';

interface UseChatMessagesParams {
  database: Database | null;
  conversationId: string;
  chatId: string;
  chatType: 'direct' | 'group';
  user: { id: string; avatarUrl?: string } | null;
  onMessage: (callback: (data: any) => void) => () => void;
  onMessageSent: (callback: (data: WebSocketMessageData) => void) => () => void;
  joinChat: (conversationId: string) => void;
  leaveChat: (conversationId: string) => void;
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
  onMessage,
  onMessageSent,
  joinChat,
  leaveChat,
  syncMessagesFromServer,
  syncConversationInfo,
  syncUserInfo,
}: UseChatMessagesParams) => {
  const [messages, setMessages] = useState<MessageInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestMsgId, setLatestMsgId] = useState<string | null>(null);

  // 存储好友头像的 ref
  const friendAvatarsRef = useRef<Map<string, string>>(new Map());

  // 超时定时器管理
  const sendingTimeouts = useRef<Map<string, any>>(new Map());

  /**
   * 保存 WebSocket 消息到本地数据库
   */
  const saveMessageToLocal = useCallback(async (data: WebSocketMessageData) => {
    if (!database) return;

    try {
      logger.debug('useChatMessages', 'saveMessageToLocal called with:', data);

      let localMessage = null;
      if (data.msgId) {
        const messagesByMsgId = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(data.msgId)))
          .fetch();
        localMessage = messagesByMsgId[0];
        logger.debug('useChatMessages', 'Found message by msgId:', localMessage ? 'yes' : 'no');
      }

      if (localMessage) {
        await database.write(async () => {
          await localMessage.update((msg: Message) => {
            msg.status = 'sent';
          });
        });
        logger.debug('useChatMessages', 'Message status updated to sent');
      } else {
        await database.write(async () => {
          await database.collections.get<Message>('messages').create((message: Message) => {
            message.msgId = data.msgId;
            message.conversationId = data.conversationId || conversationId;
            message.chatType = data.chatType || 'direct';
            message.targetId = data.targetId || chatId;
            message.text = data.text;
            message.senderId = data.senderId;
            message.chatSessionId = data.targetId || chatId;
            message.status = data.status || 'sent';
            message.timestamp = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
          });
        });
        logger.debug('useChatMessages', 'New message saved to local');
      }
    } catch (error) {
      logger.error('useChatMessages', 'Save message to local failed:', error);
    }
  }, [database, conversationId, chatId]);

  /**
   * 处理消息发送确认（WebSocket message_sent 事件）
   */
  const handleMessageSent = useCallback((data: WebSocketMessageData) => {
    logger.debug('useChatMessages', 'Received message_sent event:', JSON.stringify(data));

    const updateLocalMessage = async () => {
      try {
        if (!database || !data.msgId) {
          logger.warn('useChatMessages', 'No database or msgId, skipping update');
          return;
        }

        const messages = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(data.msgId)))
          .fetch();

        logger.debug('useChatMessages', 'Found', messages.length, 'local messages with msgId:', data.msgId);

        if (messages.length > 0) {
          await database.write(async () => {
            await messages[0].update((m: Message) => {
              m.status = 'sent';
            });

            // 更新会话的最新消息
            const conversations = await database.collections
              .get<Message>('conversations')
              .query(Q.where('conversation_id', Q.eq(conversationId)))
              .fetch();

            if (conversations.length > 0) {
              await conversations[0].update((c: any) => {
                c.latestMsgId = data.msgId;
                c.latestSummary = messages[0].text;
                c.latestSenderId = data.senderId || 'unknown';
                c.updatedAt = Date.now();
              });
            }
          });

          // 更新 UI 状态
          setMessages(prevMessages =>
            prevMessages.map(msg =>
              msg.msgId === data.msgId
                ? { ...msg, sending: false }
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

      // 获取所有发送者 ID
      const senderIds = [...new Set(dbMessages.map(m => m.senderId).filter(Boolean))];
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
      const formattedMessages = dbMessages.map(msg => {
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

    // 加入聊天室
    logger.debug('useChatMessages', 'Joining chat room:', conversationId);
    joinChat(conversationId);

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
          };
        });

        setMessages(formattedMessages);
      });

    // WebSocket 消息监听
    const unsubscribeMessage = onMessage((data: any) => {
      logger.info('useChatMessages', 'Received message from WebSocket:', data);
      saveMessageToLocal(data);

      if (data.msgId && (!latestMsgId || data.msgId > latestMsgId)) {
        setLatestMsgId(data.msgId);
      }
    });

    // WebSocket message_sent 事件监听
    const unsubscribeMessageSent = onMessageSent(handleMessageSent);

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
      leaveChat(conversationId);

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
    onMessage,
    onMessageSent,
    joinChat,
    leaveChat,
    syncMessagesFromServer,
    syncConversationInfo,
    syncUserInfo,
    loadMessagesFromDatabase,
    saveMessageToLocal,
    handleMessageSent,
  ]);

  return {
    messages,
    setMessages,
    loading,
    latestMsgId,
    sendingTimeouts,
  };
};
