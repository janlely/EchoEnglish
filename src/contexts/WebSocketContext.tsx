import React, { createContext, useContext, useEffect, useState } from 'react';
import { WebSocketService, authEventEmitter } from '../services/WebSocketService';
import { useAuth } from './AuthContext';
import { ApiService } from '../services/ApiService';
import logger from '../utils/logger';

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (
    conversationId: string,
    text: string,
    type?: string,
    msgId?: string,
    chatType?: 'direct' | 'group',
    onSent?: (success: boolean, error?: string, errorCode?: string) => void
  ) => void;
  markRead: (chatId: string, conversationId: string, chatType: 'direct' | 'group') => void;
  startTyping: (chatId: string, conversationId: string, chatType: 'direct' | 'group') => void;
  stopTyping: (chatId: string, conversationId: string, chatType: 'direct' | 'group') => void;
  sendAssistantRequest: (id: string, input: string, conversationId: string) => void;
  sendTranslateRequest: (data: { id: string; messageId: string; conversationId: string }) => void;
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
        logger.info('WebSocketContext', '✅ WebSocket connected successfully');
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      })
      .catch((error: Error) => {
        logger.warn('WebSocketContext', '⚠️ WebSocket connect failed:', error.message);
        setIsConnected(false);

        // 如果是认证失败，清除 token 并触发 logout
        if (error.message === 'Authentication failed' || error.message.includes('Authentication')) {
          logger.info('WebSocketContext', '🔑 WebSocket authentication failed, clearing tokens...');
          ApiService.clearTokens().then(() => {
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
      logger.info('WebSocketContext', '🔌 Disconnecting WebSocket (not authenticated)');
      WebSocketService.disconnect();
      setIsConnected(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    // 已登录时连接 WebSocket
    logger.info('WebSocketContext', '🔌 Connecting WebSocket (authenticated)');
    connectWebSocket();

    // 定期检查连接状态
    const checkInterval = setInterval(() => {
      if (!WebSocketService.isConnected()) {
        logger.warn('WebSocketContext', '⚠️ WebSocket disconnected, attempting to reconnect...');
        connectWebSocket();
      }
    }, 10000); // 每 10 秒检查一次

    return () => {
      // 只在组件卸载时断开连接（比如用户退出登录）
      logger.info('WebSocketContext', '🔌 WebSocketProvider unmounting, cleaning up...');
      if (!isAuthenticated) {
        WebSocketService.disconnect();
        setIsConnected(false);
      }
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
        sendMessage: (conversationId, text, type, msgId, chatType, onSent) => {
          WebSocketService.sendMessage(conversationId, text, type, msgId, chatType, onSent);
        },
        markRead: (chatId, conversationId, chatType) => {
          WebSocketService.markRead(chatId, conversationId, chatType);
        },
        startTyping: (chatId, conversationId, chatType) => {
          WebSocketService.startTyping(chatId, conversationId, chatType);
        },
        stopTyping: (chatId, conversationId, chatType) => {
          WebSocketService.stopTyping(chatId, conversationId, chatType);
        },
        sendAssistantRequest: (id, input, conversationId) => {
          WebSocketService.sendAssistantRequest(id, input, conversationId);
        },
        sendTranslateRequest: (data) => {
          WebSocketService.sendTranslateRequest(data);
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