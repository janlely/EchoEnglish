// WebSocket Event Types

// Message event data
export interface WebSocketMessageData {
  id?: string;
  msgId?: string;
  text: string;
  type?: 'text' | 'image' | 'file';
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  senderId: string;
  conversationId?: string;
  targetId?: string;
  chatType?: 'direct' | 'group';
  createdAt?: number | string;
}

// User status event data
export interface WebSocketUserStatusData {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

// Typing event data
export interface WebSocketTypingData {
  conversationId: string;
  userId: string;
  userName?: string;
}

// Messages read event data
export interface WebSocketMessagesReadData {
  conversationId: string;
  userId: string;
  msgId?: string;
  timestamp?: string;
}

// Notification event data
export interface WebSocketNotificationData {
  id: string;
  type: 'message' | 'friend_request' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead?: boolean;
  createdAt?: string;
}

// Generic WebSocket event handler type
export type WebSocketEventHandler<T = unknown> = (data: T) => void;

// Event map for type-safe event handling
export interface WebSocketEventMap {
  receive_message: WebSocketMessageData;
  message_sent: WebSocketMessageData;
  user_status_changed: WebSocketUserStatusData;
  user_typing: WebSocketTypingData;
  user_stopped_typing: WebSocketTypingData;
  messages_read: WebSocketMessagesReadData;
  new_notification: WebSocketNotificationData;
  error: Error;
  disconnect: void;
  connect: void;
}
