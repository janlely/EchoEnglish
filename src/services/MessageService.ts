/**
 * MessageService - 全局消息服务
 *
 * 负责：
 * - 监听所有新消息（无论用户在哪个页面）
 * - 保存消息到本地数据库
 * - 通知监听器有新消息
 *
 * 注意：未读数管理由后端接口负责，本服务只负责消息存储和通知
 */

import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { Message, Conversation, Friend } from '../database/models';
import logger from '../utils/logger';
import { TokenStorage } from './TokenStorage';
import { EventBus, WebSocketMessageData } from '../events/EventBus';

type MessageListener = (data: WebSocketMessageData) => void;
type ConversationUpdateListener = () => void;

class MessageService {
  private database: Database | null = null;
  private wsCleanup: (() => void) | null = null;
  private messageListeners: Set<MessageListener> = new Set();
  private conversationUpdateListeners: Set<ConversationUpdateListener> = new Set(); // 会话更新监听器
  private isSyncingGap = false;
  private isSyncingAll = false;
  private processedMsgIds = new Set<string>(); // 已处理的消息 ID 缓存（内存去重）
  private processingMsgIds = new Map<string, Promise<any>>(); // 正在处理中的消息 ID -> Promise（防止并发重复处理）
  private readonly MAX_PROCESSED_MSG_IDS = 1000; // 最多缓存 1000 个 ID

  // 当前打开的会话 ID（用于判断是否需要增加未读数）
  private currentConversationId: string | null = null;

  /**
   * 解析 conversationId 获取 targetId
   * - 单聊：conversationId 格式为 "userId_otherUserId"，返回对方用户 ID（非 senderId 的那个）
   * - 群聊：conversationId 格式为 "group_groupId"，返回 groupId
   */
  private parseTargetId(conversationId: string, chatType: string, senderId: string): string {
    if (chatType === 'group') {
      // 群聊：conversationId = "group_" + groupId
      if (conversationId.startsWith('group_')) {
        return conversationId.replace('group_', '');
      }
      return conversationId;
    }

    // 单聊：conversationId = "userId_otherUserId"
    // 由于 UUID 本身包含 - 但不包含 _，可以用 _ 分割
    // 但注意：两个 UUID 直接用 _ 连接，所以 split('_') 会得到多个部分
    // 格式：{uuid1}_{uuid2}，其中 uuid 格式为 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    // 所以 conversationId 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx_yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy

    // 简单方法：senderId 是对话的一方，targetId 应该是另一方
    // 对于收到的消息，senderId 是发送者，targetId 也应该是发送者（因为我们要显示对方的信息）
    // 所以直接返回 senderId 作为 targetId
    return senderId;
  }

  /**
   * 设置数据库实例
   */
  setDatabase(db: Database | null) {
    this.database = db;
    logger.info('MessageService', 'Database instance set');
  }

  /**
   * 设置当前打开的会话（进入聊天页面时调用）
   */
  setCurrentConversation(conversationId: string | null) {
    this.currentConversationId = conversationId;
    logger.info('MessageService', 'Current conversation set to:', conversationId);
  }

  /**
   * 获取当前打开的会话 ID
   */
  getCurrentConversation(): string | null {
    return this.currentConversationId;
  }

  /**
   * 检查是否可以调用 seq gap 同步
   */
  checkCanSyncGap(): boolean {
    return !this.isSyncingGap && !this.isSyncingAll;
  }

  /**
   * 设置全量同步状态
   */
  setSyncingAll(syncing: boolean) {
    this.isSyncingAll = syncing;
  }

  /**
   * 开始监听新消息（通过 EventBus 全局监听）
   */
  startListener() {
    logger.info('MessageService', '🚀 startListener called');

    // 清理之前的监听（如果存在）
    if (this.wsCleanup) {
      logger.info('MessageService', 'Cleaning up previous listener before starting new one');
      this.wsCleanup();
    }

    logger.info('MessageService', 'Subscribing to EventBus ws:message...');

    // 通过 EventBus 订阅 WebSocket 消息
    this.wsCleanup = EventBus.on('ws:message', (data: WebSocketMessageData) => {
      logger.info('MessageService', '📥 EventBus ws:message received:', JSON.stringify(data));
      this.handleNewMessage(data);
    });

    logger.info('MessageService', 'Message listener started via EventBus');
  }

  /**
   * 停止监听
   */
  stopListener() {
    if (this.wsCleanup) {
      this.wsCleanup();
      this.wsCleanup = null;
      logger.info('MessageService', 'Message listener stopped');
    }
  }

  /**
   * 处理新消息
   */
  private async handleNewMessage(data: WebSocketMessageData) {
    logger.info('MessageService', '📬 handleNewMessage called with:', JSON.stringify(data));

    if (!this.database) {
      logger.warn('MessageService', '❌ Database not available, skipping message handling');
      return;
    }

    // 去重：检查内存缓存（包括已处理和正在处理的）
    if (data.msgId) {
      // 检查是否已处理完成
      if (this.processedMsgIds.has(data.msgId)) {
        logger.info('MessageService', '⚠️ Message already processed (memory cache), skipping:', data.msgId);
        return;
      }

      // 检查是否正在处理中 - 如果有正在处理的 Promise，等待它完成即可（不重复处理）
      const existingPromise = this.processingMsgIds.get(data.msgId);
      if (existingPromise) {
        logger.info('MessageService', '⏳ Message already processing, waiting for completion:', data.msgId);
        // 等待现有处理完成，但不重复执行
        return existingPromise.catch(err => {
          logger.warn('MessageService', 'Existing processing failed, but not re-processing:', data.msgId);
        });
      }

      // 检查数据库是否已存在
      const existingMessages = await this.database.collections
        .get<Message>('messages')
        .query(Q.where('msg_id', Q.eq(data.msgId)))
        .fetch();

      if (existingMessages.length > 0) {
        logger.info('MessageService', '⚠️ Message already exists in DB, skipping:', data.msgId);
        this.addToProcessedCache(data.msgId);
        return;
      }
    }

    // 创建处理 Promise 并存储到 processingMsgIds
    const processPromise = this._processMessage(data);
    const msgId = data.msgId; // 捕获 msgId 用于 finally 回调

    if (msgId) {
      this.processingMsgIds.set(msgId, processPromise);
      logger.debug('MessageService', 'Added msgId to processing map:', msgId);

      // 处理完成后清理
      processPromise.finally(() => {
        this.processingMsgIds.delete(msgId);
        this.addToProcessedCache(msgId);
        logger.debug('MessageService', 'Removed msgId from processing map, added to processed cache:', msgId);
      });
    }

    return processPromise;
  }

  /**
   * 实际处理消息的内部方法
   */
  private async _processMessage(data: WebSocketMessageData) {
    try {
      // 保存消息到数据库并更新会话信息（同一个事务）
      logger.info('MessageService', '💾 Saving message and updating conversation in single transaction...');
      await this.saveMessageAndUpdateConversation(data);

      // 通知消息监听器
      logger.info('MessageService', '📢 Notifying message listeners, count:', this.messageListeners.size);
      this.messageListeners.forEach(listener => listener(data));

      logger.info('MessageService', 'Message handled successfully, chatType:', data.chatType, 'senderId:', data.senderId);
    } catch (error) {
      logger.error('MessageService', '❌ Handle new message error:', error);
      throw error; // 重新抛出错误，让调用者知道
    }
  }

  /**
   * 添加消息 ID 到已处理缓存
   */
  private addToProcessedCache(msgId: string) {
    // 如果缓存已满，删除最旧的一半
    if (this.processedMsgIds.size >= this.MAX_PROCESSED_MSG_IDS) {
      const toDelete = Array.from(this.processedMsgIds).slice(0, this.MAX_PROCESSED_MSG_IDS / 2);
      toDelete.forEach(id => this.processedMsgIds.delete(id));
      logger.debug('MessageService', 'Cleared old processed message IDs from cache');
    }
    this.processedMsgIds.add(msgId);
    logger.debug('MessageService', 'Added msgId to processed cache:', msgId, 'cache size:', this.processedMsgIds.size);
  }

  /**
   * 保存消息到数据库并更新会话（同一个事务）
   */
  private async saveMessageAndUpdateConversation(data: WebSocketMessageData) {
    if (!this.database) {
      logger.warn('MessageService', '❌ Database not available in saveMessageAndUpdateConversation');
      return;
    }

    const db = this.database;

    try {
      await db.write(async () => {
        // 1. 在事务内再次检查消息是否存在（防止并发写入）
        if (data.msgId) {
          const existingMessages = await db.collections
            .get<Message>('messages')
            .query(Q.where('msg_id', Q.eq(data.msgId)))
            .fetch();

          if (existingMessages.length > 0) {
            logger.info('MessageService', '⚠️ Message already exists in DB (inside transaction), skipping create:', data.msgId);
            // 消息已存在，只更新会话
            const conversationId = data.conversationId || data.targetId || '';
            const conversations = await db.collections
              .get<Conversation>('conversations')
              .query(Q.where('conversation_id', Q.eq(conversationId)))
              .fetch();

            if (conversations.length > 0) {
              await conversations[0].update((conv: Conversation) => {
                conv.latestSeq = data.seq || 0;
                conv.latestSummary = data.text;
                conv.latestSenderId = data.senderId;
                conv.latestTimestamp = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
                // 只有非当前会话才增加未读数
                const isCurrentConversation = this.currentConversationId === conversationId;
                if (!isCurrentConversation) {
                  conv.unreadCount = (conv.unreadCount || 0) + 1;
                }
                conv.updatedAt = Date.now();
              });
            }
            return; // 提前返回，不创建重复消息
          }
        }

        // 2. 创建消息记录
        logger.info('MessageService', 'Creating message record...');
        await db.collections.get<Message>('messages').create((message: Message) => {
          message.msgId = data.msgId || '';
          message.seq = data.seq || 0;
          message.conversationId = data.conversationId || data.targetId || '';
          message.chatType = data.chatType || 'direct';
          message.targetId = data.targetId || data.conversationId || '';
          message.text = data.text || '';
          message.senderId = data.senderId || '';
          message.chatSessionId = data.targetId || data.conversationId || '';
          message.status = data.status || 'sent';
          message.timestamp = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
        });

        // 3. 更新或创建会话记录
        const conversationId = data.conversationId || data.targetId || '';
        const conversations = await db.collections
          .get<Conversation>('conversations')
          .query(Q.where('conversation_id', Q.eq(conversationId)))
          .fetch();

        // 计算 targetId：优先使用 data.targetId，如果没有则解析 conversationId
        const targetId = data.targetId || this.parseTargetId(conversationId, data.chatType || 'direct', data.senderId || '');
        logger.info('MessageService', 'Parsed targetId:', targetId, 'from conversationId:', conversationId, 'senderId:', data.senderId);

        if (conversations.length > 0) {
          logger.info('MessageService', '📝 Updating existing conversation:', conversationId);
          await conversations[0].update((conv: Conversation) => {
            conv.latestSeq = data.seq || 0;
            conv.latestSummary = data.text;
            conv.latestSenderId = data.senderId;
            conv.latestTimestamp = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
            // 只有非当前会话才增加未读数
            const isCurrentConversation = this.currentConversationId === conversationId;
            if (!isCurrentConversation) {
              conv.unreadCount = (conv.unreadCount || 0) + 1;
            }
            conv.updatedAt = Date.now();
          });
        } else {
          logger.info('MessageService', '➕ Creating new conversation:', conversationId);
          // 检查是否为当前会话
          const isCurrentConversation = this.currentConversationId === conversationId;
          await db.collections.get<Conversation>('conversations').create((conv: Conversation) => {
            conv.conversationId = conversationId;
            conv.type = data.chatType || 'direct';
            conv.targetId = targetId;
            conv.latestSeq = data.seq || 0;
            conv.latestSummary = data.text;
            conv.latestSenderId = data.senderId;
            conv.latestTimestamp = data.createdAt ? new Date(data.createdAt).getTime() : Date.now();
            conv.lastReadSeq = 0;
            conv.unreadCount = isCurrentConversation ? 0 : 1; // 当前会话不增加未读数
            conv.isPinned = false;
            conv.createdAt = Date.now();
            conv.updatedAt = Date.now();
          });
        }

        logger.info('MessageService', '✅ Message and conversation saved in single transaction');
      });

      // 3. 验证：读取确认更新
      const verifyConversationId = data.conversationId || data.targetId || '';
      const verifyConversations = await db.collections
        .get<Conversation>('conversations')
        .query(Q.where('conversation_id', Q.eq(verifyConversationId)))
        .fetch();

      if (verifyConversations.length > 0) {
        logger.info('MessageService', '✅ Verification - Conversation after update:', {
          conversationId: verifyConversations[0].conversationId,
          latestSummary: verifyConversations[0].latestSummary,
          unreadCount: verifyConversations[0].unreadCount,
          updatedAt: verifyConversations[0].updatedAt,
        });
      }

      // 4. 单聊时同步好友信息
      if (data.chatType === 'direct' && data.senderId) {
        logger.info('MessageService', 'Direct chat detected, syncing friend info:', data.senderId);
        await this.syncFriendInfoIfMissing(data.senderId);
      }

      // 5. 通知会话更新监听器（在 db.write 事务完成后）
      this.notifyConversationUpdate();
    } catch (error) {
      logger.error('MessageService', 'Save message and update conversation error:', error);
      throw error;
    }
  }

  /**
   * 同步好友信息（如果本地缺失）
   */
  private async syncFriendInfoIfMissing(userId: string) {
    try {
      // 在事务内再次检查，防止竞态条件导致重复创建
      const friends = await this.database!.collections
        .get<Friend>('friends')
        .query(Q.where('friend_id', Q.eq(userId)))
        .fetch();

      if (friends.length > 0) {
        // 已有好友信息，无需同步
        logger.debug('MessageService', 'Friend exists, skip sync:', userId);
        return;
      }

      // 调用 API 获取用户信息
      const token = await this.getAuthToken();
      if (!token) {
        logger.warn('MessageService', 'No token, skip friend info sync');
        return;
      }

      const response = await fetch(`${this.getApiBase()}/api/users/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        logger.warn('MessageService', 'Failed to fetch user info:', userId);
        return;
      }

      const userData: any = await response.json();

      // 保存到 friends 表
      await this.database!.write(async () => {
        // 在事务内再次检查（双重检查）
        const friendsInTx = await this.database!.collections
          .get<Friend>('friends')
          .query(Q.where('friend_id', Q.eq(userId)))
          .fetch();

        if (friendsInTx.length > 0) {
          logger.debug('MessageService', 'Friend created in transaction, skip:', userId);
          return;
        }

        await this.database!.collections.get<Friend>('friends').create((f: Friend) => {
          f.friendId = userData.id || userId;
          f.name = userData.name || 'Unknown';
          f.avatarUrl = userData.avatarUrl || undefined;
          f.email = userData.email || undefined;
          f.isOnline = userData.isOnline || false;
          f.createdAt = Date.now();
          f.updatedAt = Date.now();
        });
      });

      logger.info('MessageService', 'Synced friend info:', userId);
    } catch (error) {
      logger.error('MessageService', 'Sync friend info error:', error);
    }
  }

  /**
   * seq 缺失同步
   */
  async syncSeqGap(conversationId: string, fromSeq: number, toSeq: number) {
    if (!this.checkCanSyncGap()) {
      logger.warn('MessageService', 'Already syncing, skip seq gap sync');
      return;
    }

    this.isSyncingGap = true;
    try {
      const token = await this.getAuthToken();
      if (!token) {
        logger.warn('MessageService', 'No token, skip seq gap sync');
        return;
      }

      const url = `${this.getApiBase()}/api/chats/messages/sync-seq-gap?` +
        `conversationId=${conversationId}&fromSeq=${fromSeq}&toSeq=${toSeq}`;

      logger.info('MessageService', 'Syncing seq gap:', fromSeq, '->', toSeq);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data: any = await response.json();

      if (!response.ok || !data.success) {
        logger.error('MessageService', 'Sync seq gap failed:', data.error);
        return;
      }

      // 保存缺失的消息到本地
      if (data.data.messages && data.data.messages.length > 0) {
        logger.info('MessageService', 'Synced', data.data.messages.length, 'missing messages');
        await this.saveMessages(data.data.messages);
      }
    } catch (error) {
      logger.error('MessageService', 'Sync seq gap error:', error);
    } finally {
      this.isSyncingGap = false;
    }
  }

  /**
   * 保存多条消息
   */
  private async saveMessages(messages: any[]) {
    if (!this.database) return;

    try {
      await this.database.write(async () => {
        for (const msg of messages) {
          try {
            // 检查是否已存在
            const existing = await this.database!.collections
              .get<Message>('messages')
              .query(Q.where('msg_id', Q.eq(msg.msgId)))
              .fetch();

            if (existing.length === 0) {
              await this.database!.collections.get<Message>('messages').create((message: Message) => {
                message.msgId = msg.msgId;
                message.seq = msg.seq;
                message.conversationId = msg.conversationId || '';
                message.chatType = msg.chatType || 'direct';
                message.targetId = msg.targetId || '';
                message.text = msg.text;
                message.senderId = msg.senderId;
                message.chatSessionId = msg.senderId;
                message.status = msg.status || 'sent';
                message.timestamp = new Date(msg.createdAt).getTime();
              });
            }
          } catch (e) {
            logger.debug('MessageService', 'Save message error:', msg.msgId, e);
          }
        }
      });
      logger.debug('MessageService', 'Messages saved');
    } catch (error) {
      logger.error('MessageService', 'Save messages error:', error);
    }
  }

  /**
   * Get auth token from AsyncStorage
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      const { TokenStorage } = await import('../services/TokenStorage');
      const { accessToken } = await TokenStorage.getTokens();
      return accessToken || null;
    } catch {
      return null;
    }
  }

  /**
   * Get API base URL
   */
  private getApiBase(): string {
    try {
      const { API_CONFIG } = require('../config/constants');
      return API_CONFIG.BASE_URL;
    } catch {
      return 'http://localhost:3000';
    }
  }

  /**
   * 添加消息监听器
   */
  addMessageListener(callback: MessageListener): () => void {
    this.messageListeners.add(callback);

    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * 订阅会话更新事件
   * 当新消息到来导致会话创建或更新时触发（在 db.write 事务完成后）
   */
  onConversationUpdate(callback: ConversationUpdateListener): () => void {
    this.conversationUpdateListeners.add(callback);
    return () => {
      this.conversationUpdateListeners.delete(callback);
    };
  }

  /**
   * 通知所有会话更新监听器
   */
  private notifyConversationUpdate() {
    this.conversationUpdateListeners.forEach(callback => callback());
  }
}

// 导出单例
export const messageService = new MessageService();
export default messageService;
