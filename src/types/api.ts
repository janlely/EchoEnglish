// API Response Types

// Base user interface
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

// Base API response structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages?: number;
  };
}

// Auth responses
export interface LoginResponseData {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends ApiResponse<LoginResponseData> {}

export interface RegisterResponseData {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse extends ApiResponse<RegisterResponseData> {}

export interface UserResponseData {
  user: ApiUser;
}

export interface UserResponse extends ApiResponse<UserResponseData> {}

export interface RefreshTokenResponseData {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenResponse extends ApiResponse<RefreshTokenResponseData> {}

// Message types
export interface ApiMessage {
  id: string;
  msgId: string;
  text: string;
  type: 'text' | 'image' | 'file';
  status: 'sending' | 'sent' | 'delivered' | 'read';
  senderId: string;
  conversationId?: string;
  targetId?: string;
  chatType?: 'direct' | 'group';
  sender: ApiUser;
  createdAt: string;
}

export interface MessagesResponse extends ApiResponse<ApiMessage[]> {}

// Session/Conversation types
export interface ApiSession {
  conversationId: string;
  targetId?: string;
  chatType: 'direct' | 'group';
  name: string;
  avatarUrl?: string | null;
  unreadCount: number;
  lastMessage?: {
    id: string;
    msgId?: string;
    text: string;
    senderId: string;
    timestamp?: number | string;
  } | null;
}

export interface SessionsResponse extends ApiResponse<{ sessions: ApiSession[] }> {}

// Friend types
export interface ApiFriend {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

export interface ApiFriendRequest {
  id: string;
  sender: ApiUser;
  receiver?: ApiUser;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface FriendsResponse extends ApiResponse<ApiFriend[]> {}

export interface FriendRequestsResponse extends ApiResponse<ApiFriendRequest[]> {}

// Error response
export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
}
