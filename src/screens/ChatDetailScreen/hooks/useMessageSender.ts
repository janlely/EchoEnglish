/**
 * useMessageSender - 消息发送逻辑
 * 
 * 负责：
 * - 发送消息
 * - 重试失败消息
 * - 发送翻译结果
 * - 超时处理
 */

import { useCallback, RefObject } from 'react';
import { Q } from '@nozbe/watermelondb';
import { Database } from '@nozbe/watermelondb';
import { Message, Conversation } from '../../../database/models';
import { MessageInterface } from '../types';
import { generateMsgId, SENDING_TIMEOUT } from '../utils';
import logger from '../../../utils/logger';

interface UseMessageSenderParams {
  database: Database | null;
  conversationId: string;
  chatId: string;
  chatType: 'direct' | 'group';
  user: { id: string; avatarUrl?: string } | null;
  inputText: string;
  setInputText: (text: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<MessageInterface[]>>;
  sendMessage: (
    conversationId: string,
    text: string,
    type: string,
    msgId: string,
    chatType: string
  ) => void;
  sendingTimeouts: RefObject<Map<string, any>>;
}

export const useMessageSender = ({
  database,
  conversationId,
  chatId,
  chatType,
  user,
  inputText,
  setInputText,
  setMessages,
  sendMessage,
  sendingTimeouts,
}: UseMessageSenderParams) => {
  /**
   * 发送消息
   */
  const handleSendMessage = useCallback(async () => {
    logger.debug('useMessageSender', 'handleSendMessage called');
    logger.debug('useMessageSender', 'inputText:', inputText);
    logger.debug('useMessageSender', 'conversationId:', conversationId);

    if (inputText.trim() === '' || !database) {
      logger.warn('useMessageSender', 'Skipping send: empty text or no database');
      return;
    }

    try {
      const msgId = generateMsgId();
      const tempId = `temp_${Date.now()}`;
      const currentUserId = user?.id || '';
      const timestamp = Date.now();

      // 1. 保存到本地数据库（sending: true）
      await database.write(async () => {
        await database.collections.get<Message>('messages').create((message: any) => {
          message.msgId = msgId;
          message.conversationId = conversationId;
          message.chatType = chatType;
          message.targetId = chatId;
          message.text = inputText;
          message.senderId = currentUserId;
          message.chatSessionId = chatId;
          message.status = 'sending';
          message.timestamp = timestamp;
          message.createdAt = timestamp;
          message.updatedAt = timestamp;
        });

        // 更新会话
        const existingConversations = await database.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(conversationId)))
          .fetch();

        if (existingConversations.length > 0) {
          await existingConversations[0].update((c: Conversation) => {
            c.latestMsgId = msgId;
            c.latestSummary = inputText;
            c.latestSenderId = currentUserId;
            c.latestTimestamp = timestamp;
            c.updatedAt = timestamp;
          });
        } else {
          await database.collections.get<Conversation>('conversations').create((c: Conversation) => {
            c.conversationId = conversationId;
            c.type = chatType;
            c.targetId = chatId;
            c.latestMsgId = msgId;
            c.latestSummary = inputText;
            c.latestSenderId = currentUserId;
            c.latestTimestamp = timestamp;
            c.unreadCount = 0;
            c.createdAt = timestamp;
            c.updatedAt = timestamp;
          });
        }
      });
      logger.debug('useMessageSender', 'Message saved to local with sending status');

      // 2. 通过 WebSocket 发送
      logger.debug('useMessageSender', 'Calling sendMessage via WebSocket with msgId:', msgId);
      sendMessage(conversationId, inputText, 'text', msgId, chatType);

      // 设置超时定时器
      const timeout = setTimeout(() => {
        logger.warn('useMessageSender', 'Message sending timeout:', msgId);
        setMessages(prev =>
          prev.map(msg =>
            msg.msgId === msgId ? { ...msg, sending: false, failed: true } : msg
          )
        );
        sendingTimeouts.current?.delete(msgId);
      }, SENDING_TIMEOUT);

      sendingTimeouts.current?.set(msgId, timeout);

      // 清空输入框
      setInputText('');
    } catch (error) {
      logger.error('useMessageSender', 'Error sending message:', error);
    }
  }, [database, conversationId, chatId, chatType, user, inputText, sendMessage, setMessages, setInputText, sendingTimeouts]);

  /**
   * 重试发送失败的消息
   */
  const handleRetryMessage = useCallback(async (message: MessageInterface) => {
    logger.debug('useMessageSender', 'Retrying message:', message.msgId);

    if (!message.text || !database) return;

    try {
      const newMsgId = generateMsgId();
      const timestamp = Date.now();
      const currentUserId = user?.id || '';

      // 更新数据库中的消息
      await database.write(async () => {
        const messages = await database.collections
          .get<Message>('messages')
          .query(Q.where('msg_id', Q.eq(message.msgId || '')))
          .fetch();

        if (messages.length > 0) {
          await messages[0].update((msg: any) => {
            msg.msgId = newMsgId;
            msg.status = 'sending';
            msg.timestamp = timestamp;
            msg.updatedAt = timestamp;
          });
        }
      });

      // 更新 UI 状态
      setMessages(prev =>
        prev.map(msg =>
          msg.msgId === message.msgId
            ? { ...msg, msgId: newMsgId, sending: true, failed: false, timestamp: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
            : msg
        )
      );

      // 重新发送
      sendMessage(conversationId, message.text, 'text', newMsgId, chatType);

      // 设置新的超时定时器
      const timeout = setTimeout(() => {
        logger.warn('useMessageSender', 'Retry message timeout:', newMsgId);
        setMessages(prev =>
          prev.map(msg =>
            msg.msgId === newMsgId ? { ...msg, sending: false, failed: true } : msg
          )
        );
        sendingTimeouts.current?.delete(newMsgId);
      }, SENDING_TIMEOUT);

      sendingTimeouts.current?.set(newMsgId, timeout);
    } catch (error) {
      logger.error('useMessageSender', 'Retry message error:', error);
    }
  }, [database, conversationId, chatType, user, setMessages, sendMessage, sendingTimeouts]);

  /**
   * 发送翻译结果
   */
  const handleAcceptTranslation = useCallback(async (selectedText: string) => {
    if (!database) return;

    try {
      const msgId = generateMsgId();
      const timestamp = Date.now();

      logger.debug('useMessageSender', 'handleAcceptTranslation called with text:', selectedText);
      logger.debug('useMessageSender', 'Generated msgId:', msgId);

      // 创建消息
      const newMessage = await database.write(async () => {
        return database.collections.get<Message>('messages').create(message => {
          message.text = selectedText;
          message.senderId = user?.id || '';
          message.chatSessionId = chatId;
          message.status = 'sending';
          message.msgId = msgId;
          message.timestamp = timestamp;
          message.conversationId = conversationId;
          message.chatType = chatType;
          message.targetId = chatId;
        });
      });

      logger.debug('useMessageSender', 'Message created in database:', {
        id: newMessage.id,
        msgId: newMessage.msgId,
        text: newMessage.text,
      });

      // 更新会话
      await database.write(async () => {
        const existingConversations = await database.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(conversationId)))
          .fetch();

        if (existingConversations.length > 0) {
          await existingConversations[0].update((c: Conversation) => {
            c.latestMsgId = msgId;
            c.latestSummary = selectedText;
            c.latestSenderId = user?.id || '';
            c.latestTimestamp = timestamp;
            c.updatedAt = timestamp;
          });
        } else {
          await database.collections.get<Conversation>('conversations').create((c: Conversation) => {
            c.conversationId = conversationId;
            c.type = chatType;
            c.targetId = chatId;
            c.latestMsgId = msgId;
            c.latestSummary = selectedText;
            c.latestSenderId = user?.id || '';
            c.latestTimestamp = timestamp;
            c.unreadCount = 0;
            c.createdAt = timestamp;
            c.updatedAt = timestamp;
          });
        }
      });

      // 通过 WebSocket 发送
      logger.debug('useMessageSender', 'Calling sendMessage via WebSocket with msgId:', msgId);
      sendMessage(conversationId, selectedText, 'text', msgId, chatType);
    } catch (error) {
      logger.error('useMessageSender', 'Error sending translation:', error);
    }
  }, [database, conversationId, chatId, chatType, user, sendMessage]);

  return {
    handleSendMessage,
    handleRetryMessage,
    handleAcceptTranslation,
  };
};
