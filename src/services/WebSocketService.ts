import { io, Socket } from 'socket.io-client';
import { WS_CONFIG } from '../config/constants';
import { TokenStorage } from './TokenStorage';
import logger from '../utils/logger';
import { EventBus } from '../events/EventBus';
import { ErrorCode } from '../constants/errorCodes';

// 发送超时配置
const SEND_TIMEOUT = 10000; // 10 秒

// WebSocket 错误事件类型
export interface WebSocketError {
  code: string;
  message: string;
  msgId?: string;
}

// Simple cross-platform event emitter for auth events only
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

class WebSocketServiceClass {
  private socket: Socket | null = null;
  // 消息发送超时管理：msgId -> { timeout, callback }
  private pendingSends = new Map<string, { timeout: ReturnType<typeof setTimeout>; callback: (success: boolean, error?: string, errorCode?: string) => void }>();

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

    // 接收消息 -> 通过 EventBus 广播
    this.socket.on('receive_message', (data: any) => {
      logger.info('WebSocketService', '🔔 Received receive_message event from server');
      EventBus.emit('ws:message', data);
    });

    // 消息发送成功 -> 通知 pendingSends 并广播
    this.socket.on('message_sent', (data: { msgId?: string; messageId?: string; status?: string }) => {
      logger.info('WebSocketService', '📤 Received message_sent event:', JSON.stringify(data));
      EventBus.emit('ws:message_sent', data);
      // 通知消息发送成功
      if (data.msgId) {
        this.notifyMessageSent(data.msgId);
      }
    });

    // 发送错误 -> 通知 pendingSends 并广播
    this.socket.on('error', (error: WebSocketError) => {
      logger.info('WebSocketService', '📛 Received error event:', error);
      // 通知消息发送失败
      if (error.msgId) {
        this.notifyMessageFailed(error.msgId, error.message, error.code);
      }
      // 广播错误事件
      EventBus.emit('ws:send_error', error);
    });

    // 用户状态变更
    this.socket.on('user_status_changed', (data: any) => {
      EventBus.emit('ws:user_status', data);
    });

    // 输入状态
    this.socket.on('user_typing', (data: any) => {
      EventBus.emit('ws:typing', data);
    });

    this.socket.on('user_stopped_typing', (data: any) => {
      EventBus.emit('ws:typing', data);
    });

    // 消息已读
    this.socket.on('messages_read', (data: any) => {
      EventBus.emit('ws:messages_read', data);
    });

    // 通知
    this.socket.on('new_notification', (data: any) => {
      EventBus.emit('ws:notification', data);
    });

    // AI 助手响应
    this.socket.on('assistant_response_chunk', (data: any) => {
      EventBus.emit('ws:assistant_chunk', data);
    });

    // 翻译响应
    this.socket.on('translate_message_response', (data: any) => {
      logger.info('WebSocketService', 'Received translate_message_response');
      EventBus.emit('ws:translate_response', data);
    });

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
   * @param onSent 发送结果回调（true=成功，false=超时/失败，error=错误信息，errorCode=错误码）
   */
  sendMessage(
    conversationId: string,
    text: string,
    type = 'text',
    msgId: string | undefined,
    chatType: 'direct' | 'group' = 'direct',
    onSent?: (success: boolean, error?: string, errorCode?: string) => void
  ) {
    logger.info('WebSocketService', 'sendMessage called:', { conversationId, msgId, chatType });

    if (!this.socket) {
      logger.error('WebSocketService', 'socket is null, cannot send message');
      onSent?.(false);
      return;
    }

    if (!this.socket.connected) {
      logger.error('WebSocketService', 'socket not connected, cannot send message');
      onSent?.(false);
      return;
    }

    // Backend expects targetId, not conversationId
    this.socket.emit('send_message', { targetId: conversationId, text, type, msgId, chatType });
    logger.info('WebSocketService', 'Message emitted to server');

    // 设置超时处理和回调
    if (msgId && onSent) {
      const timeout = setTimeout(() => {
        logger.warn('WebSocketService', 'Message send timeout:', msgId);
        this.pendingSends.delete(msgId);
        onSent(false);
      }, SEND_TIMEOUT);

      this.pendingSends.set(msgId, { timeout, callback: onSent });
      logger.info('WebSocketService', '📌 Pending send added, msgId:', msgId, 'total pending:', this.pendingSends.size);
    } else {
      logger.warn('WebSocketService', '⚠️ No msgId or onSent callback, msgId:', msgId, 'onSent:', !!onSent);
    }
  }

  /**
   * 通知消息发送成功（内部方法，收到 message_sent 时调用）
   */
  private notifyMessageSent(msgId: string) {
    const pending = this.pendingSends.get(msgId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingSends.delete(msgId);
      pending.callback(true);
      logger.info('WebSocketService', '✅ Message confirmed:', msgId);
    } else {
      logger.warn('WebSocketService', '⚠️ No pending send for msgId:', msgId);
    }
  }

  /**
   * 通知消息发送失败（内部方法，收到 error 时调用）
   */
  private notifyMessageFailed(msgId: string, errorMessage: string, errorCode?: string) {
    logger.info('WebSocketService', 'notifyMessageFailed called, msgId:', msgId, 'pendingSends size:', this.pendingSends.size);
    const pending = this.pendingSends.get(msgId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingSends.delete(msgId);
      pending.callback(false, errorMessage, errorCode);
      logger.info('WebSocketService', '❌ Message failed:', msgId, errorMessage, 'code:', errorCode);
    } else {
      logger.warn('WebSocketService', '⚠️ No pending send found for msgId:', msgId, 'available msgIds:', Array.from(this.pendingSends.keys()));
    }
  }

  /**
   * 标记消息已读
   */
  markRead(chatId: string, conversationId: string, chatType: 'direct' | 'group') {
    this.socket?.emit('mark_read', { chatSessionId: chatId, conversationId, chatType });
  }

  /**
   * 开始输入
   */
  startTyping(chatId: string, conversationId: string, chatType: 'direct' | 'group') {
    this.socket?.emit('typing_start', { chatSessionId: chatId, conversationId, chatType });
  }

  /**
   * 停止输入
   */
  stopTyping(chatId: string, conversationId: string, chatType: 'direct' | 'group') {
    this.socket?.emit('typing_stop', { chatSessionId: chatId, conversationId, chatType });
  }

  /**
   * 发送 AI 助手请求
   */
  sendAssistantRequest(id: string, input: string, conversationId: string) {
    if (!this.socket || !this.socket.connected) {
      logger.error('WebSocketService', 'Cannot send assistant request: socket not connected');
      return;
    }
    this.socket.emit('assistant_request', { id, input, conversationId });
    logger.info('WebSocketService', 'Assistant request emitted');
  }

  /**
   * 发送翻译请求
   */
  sendTranslateRequest(data: { id: string; messageId: string; conversationId: string }) {
    if (!this.socket || !this.socket.connected) {
      logger.error('WebSocketService', 'Cannot send translate request: socket not connected');
      return;
    }
    this.socket.emit('translate_message', data);
    logger.info('WebSocketService', 'Translate request emitted');
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.socket?.disconnect();
    // 清理所有待处理的发送请求
    this.pendingSends.forEach((pending, msgId) => {
      clearTimeout(pending.timeout);
      pending.callback(false);
    });
    this.pendingSends.clear();
    this.socket = null;
    logger.info('WebSocketService', 'WebSocket disconnected');
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const WebSocketService = new WebSocketServiceClass();