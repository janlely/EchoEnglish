import React, { createContext, useContext, useEffect, useState } from 'react';
import { WebSocketService } from '../services/WebSocketService';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (chatId: string, text: string) => void;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
  markRead: (chatId: string) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  onMessage: (handler: (data: any) => void) => () => void;
  onUserStatus: (handler: (data: any) => void) => () => void;
  onTyping: (handler: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  // 只在用户登录后连接 WebSocket
  useEffect(() => {
    if (!isAuthenticated) {
      // 未登录时断开连接
      WebSocketService.disconnect();
      setIsConnected(false);
      return;
    }

    // 已登录时连接 WebSocket
    WebSocketService.connect()
      .then(() => setIsConnected(true))
      .catch((error) => {
        console.warn('WebSocket connect failed:', error.message);
        // 不打印完整错误堆栈，避免干扰
      });

    return () => {
      WebSocketService.disconnect();
      setIsConnected(false);
    };
  }, [isAuthenticated]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        sendMessage: WebSocketService.sendMessage.bind(WebSocketService),
        joinChat: WebSocketService.joinChat.bind(WebSocketService),
        leaveChat: WebSocketService.leaveChat.bind(WebSocketService),
        markRead: WebSocketService.markRead.bind(WebSocketService),
        startTyping: WebSocketService.startTyping.bind(WebSocketService),
        stopTyping: WebSocketService.stopTyping.bind(WebSocketService),
        onMessage: (handler) => {
          WebSocketService.on('receive_message', handler);
          return () => WebSocketService.off('receive_message', handler);
        },
        onUserStatus: (handler) => {
          WebSocketService.on('user_status_changed', handler);
          return () => WebSocketService.off('user_status_changed', handler);
        },
        onTyping: (handler) => {
          WebSocketService.on('user_typing', handler);
          return () => WebSocketService.off('user_typing', handler);
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
