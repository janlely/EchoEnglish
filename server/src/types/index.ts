import { Request } from 'express';

// Extended Request type with user info
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

// User data interface
export interface UserData {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

// Token payload interface
export interface TokenPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
  limit: number;
  total: number;
  totalPages: number;
  };
}

// Message types
export interface MessageData {
  text: string;
  type?: 'text' | 'image' | 'file';
  chatSessionId: string;
  senderId: string;
}

export interface MessageStatusUpdate {
  messageId: string;
  status: 'sent' | 'delivered' | 'read';
}

// Chat session types
export interface ChatSessionData {
  name?: string;
  type?: 'direct' | 'group';
  avatarUrl?: string;
  participantIds: string[];
}

// Notification types
export interface NotificationData {
  userId: string;
  type: 'message' | 'friend_request' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
}

// WebSocket event types
export interface WebSocketEvent {
  event: string;
  data: any;
  roomId?: string;
}

// Google user info
export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
