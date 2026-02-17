import { io, Socket } from 'socket.io-client';
import { WS_CONFIG } from '../config/constants';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import AuthToken from '../database/models/AuthToken';

type EventHandler = (data: any) => void;

class WebSocketServiceClass {
  private socket: Socket | null = null;
  private eventHandlers = new Map<string, Set<EventHandler>>();

  // 连接 WebSocket
  async connect() {
    // 从 WatermelonDB 获取 Token
    let token: string | null = null;
    try {
      const collection = database.collections.get<AuthToken>('auth_tokens');
      if (collection) {
        const tokens = await collection.query().fetch();
        token = tokens.length > 0 ? tokens[0].accessToken : null;
      }
    } catch (error) {
      // Token 获取失败，继续使用 null token
    }
    
    // 如果没有 Token，不尝试连接
    if (!token) {
      console.log('⚠️ WebSocket skipped: No token available');
      return Promise.resolve();
    }
    
    return new Promise<void>((resolve, reject) => {
      this.socket = io(WS_CONFIG.URL, {
        path: WS_CONFIG.PATH,
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        resolve();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ WebSocket connection error:', error);
        reject(error);
      });

      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('receive_message', (data: any) => this.emit('receive_message', data));
    this.socket.on('user_status_changed', (data: any) => this.emit('user_status_changed', data));
    this.socket.on('user_typing', (data: any) => this.emit('user_typing', data));
    this.socket.on('user_stopped_typing', (data: any) => this.emit('user_stopped_typing', data));
    this.socket.on('messages_read', (data: any) => this.emit('messages_read', data));
    this.socket.on('new_notification', (data: any) => this.emit('new_notification', data));
    this.socket.on('error', (error: any) => console.error('WebSocket error:', error));
    this.socket.on('disconnect', () => console.log('⚠️ WebSocket disconnected'));
  }

  sendMessage(chatId: string, text: string, type = 'text') {
    this.socket?.emit('send_message', { chatSessionId: chatId, text, type });
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

  on(event: string, handler: EventHandler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler) {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: any) {
    this.eventHandlers.get(event)?.forEach(handler => handler(data));
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
