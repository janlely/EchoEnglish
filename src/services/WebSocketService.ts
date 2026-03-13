import { io, Socket } from 'socket.io-client';
import { WS_CONFIG } from '../config/constants';
import { TokenStorage } from './TokenStorage';
import logger from '../utils/logger';
import {
  WebSocketMessageData,
  WebSocketUserStatusData,
  WebSocketTypingData,
  WebSocketMessagesReadData,
  WebSocketNotificationData,
} from '../types/websocket';

// 发送超时配置
const SEND_TIMEOUT = 10000; // 10 秒

// Simple cross-platform event emitter
type AuthEventHandler = () => void;

class SimpleEventEmitter {
  private handlers: Map<string, Set<AuthEventHandler>> = new Map();

  on(event: string, handler: AuthEventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: AuthEventHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string) {
    this.handlers.get(event)?.forEach(handler => handler());
  }
}

// Create event emitter for auth events
export const authEventEmitter = new SimpleEventEmitter();

// Type-safe event handler
type WebSocketEventHandler<T = unknown> = (data: T) => void;

class WebSocketServiceClass {
  private socket: Socket | null = null;
  private eventHandlers = new Map<string, Set<WebSocketEventHandler>>();
  // 消息发送超时管理：msgId -> { timeout, callback }
  private pendingSends = new Map<string, { timeout: ReturnType<typeof setTimeout>; callback: (success: boolean) => void }>();

  // 连接 WebSocket
  async connect() {
    logger.info('WebSocketService', '🔗 connect() called');

    // 如果已经连接，直接返回
    if (this.socket?.connected) {
      logger.info('WebSocketService', '✅ WebSocket already connected');
      return Promise.resolve();
    }

    // 从 AsyncStorage 获取 Token
    const { accessToken: token } = await TokenStorage.getTokens();

    // 如果没有 Token，不尝试连接
    if (!token) {
      logger.warn('WebSocketService', '⚠️ WebSocket skipped: No token available');
      return Promise.reject(new Error('No token available'));
    }

    logger.info('WebSocketService', '🔗 Creating new Socket.IO connection...');

    return new Promise<void>((resolve, reject) => {
      // 如果已有 socket，先断开
      if (this.socket) {
        logger.info('WebSocketService', '🔌 Disconnecting existing socket before reconnecting');
        this.socket.disconnect();
      }

      this.socket = io(WS_CONFIG.URL, {
        path: WS_CONFIG.PATH,
        auth: { token },
        transports: ['websocket', 'polling'], // 允许降级到 polling
        reconnection: true,
        reconnectionDelay: 1000, // 初始重连延迟 1 秒
        reconnectionDelayMax: 10000, // 最大重连延迟 10 秒
        reconnectionAttempts: 20, // 重连次数 20 次
        randomizationFactor: 0.5, // 重连延迟随机因子，避免雪崩
        perMessageDeflate: {
          threshold: 1024, // 小于 1KB 不压缩
        },
      });

      this.socket.on('connect', () => {
        logger.info('WebSocketService', '✅ WebSocket connected, socket ID:', this.socket?.id);
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        logger.error('WebSocketService', '❌ WebSocket connection error:', error.message);

        // 如果是认证失败，触发 logout 事件
        if (error.message.includes('Authentication') || error.message.includes('auth')) {
          logger.error('WebSocketService', '🔑 WebSocket authentication failed, triggering logout...');
          // 触发全局 logout 事件
          authEventEmitter.emit('logout');
        }

        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => {
        logger.info('WebSocketService', `⚠️ WebSocket disconnected: ${reason}`);
        // 如果是服务器断开，尝试重连
        if (reason === 'io server disconnect') {
          logger.info('WebSocketService', '🔄 Server disconnected, attempting to reconnect...');
          this.socket?.connect();
        }
      });

      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    logger.info('WebSocketService', 'Setting up Socket.IO event listeners');

    this.socket.on('connect', () => {
      logger.info('WebSocketService', 'Socket connected, ID:', this.socket?.id);
    });

    this.socket.on('receive_message', (data: WebSocketMessageData) => {
      logger.info('WebSocketService', '🔔 Received receive_message event from server:', JSON.stringify(data));
      this.emit('receive_message', data);
    });
    this.socket.on('message_sent', (data: WebSocketMessageData) => {
      logger.info('WebSocketService', '📤 Received message_sent event:', JSON.stringify(data));
      this.emit('message_sent', data);
      // 通知消息发送成功
      if (data.msgId) {
        this.notifyMessageSent(data.msgId);
      }
    });
    this.socket.on('user_status_changed', (data: WebSocketUserStatusData) => this.emit('user_status_changed', data));
    this.socket.on('user_typing', (data: WebSocketTypingData) => this.emit('user_typing', data));
    this.socket.on('user_stopped_typing', (data: WebSocketTypingData) => this.emit('user_stopped_typing', data));
    this.socket.on('messages_read', (data: WebSocketMessagesReadData) => this.emit('messages_read', data));
    this.socket.on('new_notification', (data: WebSocketNotificationData) => this.emit('new_notification', data));
    this.socket.on('assistant_response_chunk', (data: any) => this.emit('assistant_response_chunk', data));
    this.socket.on('translate_message_response', (data: any) => {
      logger.info('WebSocketService', 'Received translate_message_response:', JSON.stringify(data));
      this.emit('translate_message_response', data);
    });
    this.socket.on('error', (error: Error) => logger.error('WebSocketService', 'Socket error:', error.message));
    this.socket.on('disconnect', (reason: string) => {
      logger.info('WebSocketService', '⚠️ Socket disconnected, reason:', reason);
    });
  }

  /**
   * 发送消息（带超时回调）
   * @param conversationId 会话 ID
   * @param text 消息文本
   * @param type 消息类型
   * @param msgId 消息 ID（用于去重和超时处理）
   * @param chatType 聊天类型
   * @param onSent 发送结果回调（true=成功，false=超时/失败）
   */
  sendMessage(
    conversationId: string,
    text: string,
    type = 'text',
    msgId: string | undefined,
    chatType: 'direct' | 'group' = 'direct',
    onSent?: (success: boolean) => void
  ) {
    console.log('[WebSocket] sendMessage called:', { conversationId, text, type, msgId, chatType });
    console.log('[WebSocket] socket connected:', this.socket?.connected);
    console.log('[WebSocket] socket exists:', !!this.socket);

    if (!this.socket) {
      console.error('[WebSocket] socket is null, cannot send message');
      onSent?.(false);
      return;
    }

    if (!this.socket.connected) {
      console.error('[WebSocket] socket not connected, cannot send message');
      onSent?.(false);
      return;
    }

    // Backend expects targetId, not conversationId
    this.socket.emit('send_message', { targetId: conversationId, text, type, msgId, chatType });
    console.log('[WebSocket] Message emitted successfully');

    // 设置超时处理
    if (msgId && onSent) {
      const timeout = setTimeout(() => {
        console.warn('[WebSocket] Message send timeout:', msgId);
        this.pendingSends.delete(msgId);
        onSent(false);
      }, SEND_TIMEOUT);

      this.pendingSends.set(msgId, { timeout, callback: onSent });
    }
  }

  /**
   * 通知消息发送成功（由外部调用，传入 msgId）
   */
  notifyMessageSent(msgId: string) {
    const pending = this.pendingSends.get(msgId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingSends.delete(msgId);
      pending.callback(true);
      logger.info('WebSocketService', '✅ Message confirmed:', msgId);
    }
  }

  joinChat(chatId: string) {
    this.socket?.emit('join_chat', chatId);
  }

  leaveChat(chatId: string) {
    this.socket?.emit('leave_chat', chatId);
  }

  markRead(chatId: string) {
    this.socket?.emit('mark_read', { chatSessionId: chatId });
  }

  startTyping(chatId: string) {
    this.socket?.emit('typing_start', { chatSessionId: chatId });
  }

  stopTyping(chatId: string) {
    this.socket?.emit('typing_stop', { chatSessionId: chatId });
  }

  sendAssistantRequest(id: string, input: string, conversationId: string) {
    if (!this.socket) {
      console.error('[WebSocket] socket is null, cannot send assistant request');
      return;
    }

    if (!this.socket.connected) {
      console.error('[WebSocket] socket not connected, cannot send assistant request');
      return;
    }

    this.socket.emit('assistant_request', { id, input, conversationId });
    console.log('[WebSocket] Assistant request emitted successfully');
  }

  on(event: string, handler: WebSocketEventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    logger.info('WebSocketService', `📝 Listener registered for event: ${event}, total listeners: ${this.eventHandlers.get(event)!.size}`);
  }

  off(event: string, handler: WebSocketEventHandler) {
    const listeners = this.eventHandlers.get(event);
    const hadListener = listeners?.has(handler) ?? false;
    listeners?.delete(handler);
    logger.info('WebSocketService', `🗑️ Listener removed for event: ${event}, remaining: ${listeners?.size ?? 0}`);
  }

  public emit(event: string, data: unknown) {
    const listeners = this.eventHandlers.get(event);
    logger.info('WebSocketService', `📢 Emitting event: ${event}, listeners count: ${listeners?.size ?? 0}`);

    // 触发本地监听器
    listeners?.forEach(handler => handler(data));
    
    // 发送到 Socket.IO 服务器
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`⚠️ WebSocket not connected, event '${event}' not sent to server`);
    }
  }

  disconnect() {
    this.socket?.disconnect();
    // 清理所有待处理的发送请求
    this.pendingSends.forEach((pending, msgId) => {
      clearTimeout(pending.timeout);
      pending.callback(false);
    });
    this.pendingSends.clear();
    this.socket = null;
    // 注意：不清除 eventHandlers，因为监听器可能还需要
    // eventHandlers 会在下次 connect 时由 setupEventListeners 重新注册到新的 socket
    logger.info('WebSocketService', 'WebSocket disconnected');
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const WebSocketService = new WebSocketServiceClass();
