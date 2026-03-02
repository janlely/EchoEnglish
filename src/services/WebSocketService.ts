import { io, Socket } from 'socket.io-client';
import { WS_CONFIG } from '../config/constants';
import { TokenStorage } from './TokenStorage';
import {
  WebSocketMessageData,
  WebSocketUserStatusData,
  WebSocketTypingData,
  WebSocketMessagesReadData,
  WebSocketNotificationData,
} from '../types/websocket';

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

  // 连接 WebSocket
  async connect() {
    // 如果已经连接，直接返回
    if (this.socket?.connected) {
      console.log('✅ WebSocket already connected');
      return Promise.resolve();
    }

    // 从 AsyncStorage 获取 Token
    const { accessToken: token } = await TokenStorage.getTokens();

    // 如果没有 Token，不尝试连接
    if (!token) {
      console.log('⚠️ WebSocket skipped: No token available');
      return Promise.reject(new Error('No token available'));
    }

    return new Promise<void>((resolve, reject) => {
      // 如果已有 socket，先断开
      if (this.socket) {
        this.socket.disconnect();
      }

      this.socket = io(WS_CONFIG.URL, {
        path: WS_CONFIG.PATH,
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10, // 增加重连次数
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        resolve();
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('❌ WebSocket connection error:', error.message);

        // 如果是认证失败，触发 logout 事件
        if (error.message.includes('Authentication') || error.message.includes('auth')) {
          console.error('🔑 WebSocket authentication failed, triggering logout...');
          // 触发全局 logout 事件
          authEventEmitter.emit('logout');
        }

        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => {
        console.log(`⚠️ WebSocket disconnected: ${reason}`);
        // 如果是服务器断开，尝试重连
        if (reason === 'io server disconnect') {
          console.log('🔄 Server disconnected, attempting to reconnect...');
          this.socket?.connect();
        }
      });

      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('receive_message', (data: WebSocketMessageData) => this.emit('receive_message', data));
    this.socket.on('message_sent', (data: WebSocketMessageData) => this.emit('message_sent', data));
    this.socket.on('user_status_changed', (data: WebSocketUserStatusData) => this.emit('user_status_changed', data));
    this.socket.on('user_typing', (data: WebSocketTypingData) => this.emit('user_typing', data));
    this.socket.on('user_stopped_typing', (data: WebSocketTypingData) => this.emit('user_stopped_typing', data));
    this.socket.on('messages_read', (data: WebSocketMessagesReadData) => this.emit('messages_read', data));
    this.socket.on('new_notification', (data: WebSocketNotificationData) => this.emit('new_notification', data));
    this.socket.on('assistant_response_chunk', (data: any) => this.emit('assistant_response_chunk', data));
    this.socket.on('translate_message_response', (data: any) => {
      console.log('[WebSocketService] Received translate_message_response:', data);
      this.emit('translate_message_response', data);
    });
    this.socket.on('error', (error: Error) => console.error('WebSocket error:', error));
    this.socket.on('disconnect', () => console.log('⚠️ WebSocket disconnected'));
  }

  sendMessage(conversationId: string, text: string, type = 'text', msgId?: string, chatType: 'direct' | 'group' = 'direct') {
    console.log('[WebSocket] sendMessage called:', { conversationId, text, type, msgId, chatType });
    console.log('[WebSocket] socket connected:', this.socket?.connected);
    console.log('[WebSocket] socket exists:', !!this.socket);

    if (!this.socket) {
      console.error('[WebSocket] socket is null, cannot send message');
      return;
    }

    if (!this.socket.connected) {
      console.error('[WebSocket] socket not connected, cannot send message');
      return;
    }

    // Backend expects targetId, not conversationId
    this.socket.emit('send_message', { targetId: conversationId, text, type, msgId, chatType });
    console.log('[WebSocket] Message emitted successfully');
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
  }

  off(event: string, handler: WebSocketEventHandler) {
    this.eventHandlers.get(event)?.delete(handler);
  }

  public emit(event: string, data: unknown) {
    // 触发本地监听器
    this.eventHandlers.get(event)?.forEach(handler => handler(data));
    
    // 发送到 Socket.IO 服务器
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`⚠️ WebSocket not connected, event '${event}' not sent to server`);
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.eventHandlers.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const WebSocketService = new WebSocketServiceClass();
