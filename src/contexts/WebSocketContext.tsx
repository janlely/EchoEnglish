import React, { createContext, useContext, useEffect, useState } from 'react';
import { WebSocketService } from '../services/WebSocketService';
import { useAuth } from './AuthContext';
import { ApiService } from '../services/ApiService';
import { authEventEmitter } from '../services/WebSocketService';
import {
  WebSocketMessageData,
  WebSocketUserStatusData,
  WebSocketTypingData,
} from '../types/websocket';

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (conversationId: string, text: string, type?: string, msgId?: string, chatType?: 'direct' | 'group') => void;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  markRead: (chatId: string) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  translateMessage: (data: { id: string; messageId: string; conversationId: string }, handler: (response: any) => void) => () => void;
  onMessage: (handler: (data: WebSocketMessageData) => void) => () => void;
  onMessageSent: (handler: (data: WebSocketMessageData) => void) => () => void;
  onUserStatus: (handler: (data: WebSocketUserStatusData) => void) => () => void;
  onTyping: (handler: (data: WebSocketTypingData) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 连接 WebSocket
  const connectWebSocket = React.useCallback(() => {
    if (!isAuthenticated) return;

    WebSocketService.connect()
      .then(() => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      })
      .catch((error: Error) => {
        console.warn('⚠️ WebSocket connect failed:', error.message);
        setIsConnected(false);

        // 如果是认证失败，清除 token 并触发 logout
        if (error.message === 'Authentication failed' || error.message.includes('Authentication')) {
          console.log('🔑 WebSocket authentication failed, clearing tokens...');
          ApiService.clearTokens().then(() => {
            console.log('🔑 Tokens cleared');
            authEventEmitter.emit('logout');
          });
          return;
        }

        // 其他错误，3 秒后重试
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      });
  }, [isAuthenticated]);

  // 只在用户登录后连接 WebSocket
  useEffect(() => {
    if (!isAuthenticated) {
      // 未登录时断开连接
      console.log('🔌 Disconnecting WebSocket (not authenticated)');
      WebSocketService.disconnect();
      setIsConnected(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    // 已登录时连接 WebSocket
    console.log('🔌 Connecting WebSocket (authenticated)');
    connectWebSocket();

    // 定期检查连接状态
    const checkInterval = setInterval(() => {
      if (!WebSocketService.isConnected()) {
        console.warn('⚠️ WebSocket disconnected, attempting to reconnect...');
        connectWebSocket();
      }
    }, 10000); // 每 10 秒检查一次

    return () => {
      console.log('🔌 Cleaning up WebSocket connection');
      WebSocketService.disconnect();
      setIsConnected(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearInterval(checkInterval);
    };
  }, [isAuthenticated, connectWebSocket]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        sendMessage: (conversationId, text, type, msgId, chatType) => {
          WebSocketService.sendMessage(conversationId, text, type, msgId, chatType);
        },
        joinChat: (chatId) => {
          WebSocketService.joinChat(chatId);
        },
        leaveChat: (chatId) => {
          WebSocketService.leaveChat(chatId);
        },
        markRead: (chatId) => {
          WebSocketService.markRead(chatId);
        },
        startTyping: (chatId) => {
          WebSocketService.startTyping(chatId);
        },
        stopTyping: (chatId) => {
          WebSocketService.stopTyping(chatId);
        },
        translateMessage: (data, handler) => {
          console.log('[WebSocketContext] translateMessage called:', data);
          
          // 先注册监听器，再发送事件
          WebSocketService.on('translate_message_response', handler as (data: unknown) => void);
          console.log('[WebSocketContext] translate_message_response listener registered');
          
          // 稍后发送事件，确保监听器已注册
          setTimeout(() => {
            WebSocketService.emit('translate_message', data);
            console.log('[WebSocketContext] translate_message event emitted');
          }, 50);
          
          return () => {
            console.log('[WebSocketContext] Cleaning up translate_message listener');
            WebSocketService.off('translate_message_response', handler as (data: unknown) => void);
          };
        },
        onMessage: (handler: (data: WebSocketMessageData) => void) => {
          WebSocketService.on('receive_message', handler as (data: unknown) => void);
          return () => WebSocketService.off('receive_message', handler as (data: unknown) => void);
        },
        onMessageSent: (handler: (data: WebSocketMessageData) => void) => {
          WebSocketService.on('message_sent', handler as (data: unknown) => void);
          return () => WebSocketService.off('message_sent', handler as (data: unknown) => void);
        },
        onUserStatus: (handler: (data: WebSocketUserStatusData) => void) => {
          WebSocketService.on('user_status_changed', handler as (data: unknown) => void);
          return () => WebSocketService.off('user_status_changed', handler as (data: unknown) => void);
        },
        onTyping: (handler: (data: WebSocketTypingData) => void) => {
          WebSocketService.on('user_typing', handler as (data: unknown) => void);
          return () => WebSocketService.off('user_typing', handler as (data: unknown) => void);
        },
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};
