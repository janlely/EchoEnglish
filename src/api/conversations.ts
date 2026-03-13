import { ApiService } from '../services/ApiService';

export interface ConversationInfo {
  conversationId: string;
  type: 'direct' | 'group';
  targetId: string;
  name: string;
  avatarUrl?: string | null;
  unreadCount: number;
  lastReadSeq?: number | null;
  latestSeq?: number | null;
  latestSummary?: string | null;
  latestSenderId?: string | null;
  latestTimestamp?: string | null;
}

export interface Message {
  id: string;
  msgId: string;
  text: string;
  type: string;
  status: string;
  senderId: string;
  conversationId: string;
  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string;
}

export interface SyncMessagesResponse {
  messages: Message[];
  hasMore: boolean;
  latestSeq?: number;
}

/**
 * 获取有未读消息的会话列表
 */
export const getConversationsWithUnread = async (): Promise<ConversationInfo[]> => {
  const response = await ApiService.request<{ success: boolean; data: { conversations: ConversationInfo[] } }>(
    '/api/conversations/with-unread'
  );
  return response.data!.conversations;
};

/**
 * 获取会话详情
 */
export const getConversationInfo = async (
  conversationId: string
): Promise<ConversationInfo> => {
  const response = await ApiService.request<{ success: boolean; data: ConversationInfo }>(
    `/api/conversations/${conversationId}/info`
  );
  return response.data!;
};

/**
 * 更新会话读状态
 */
export const updateReadStatus = async (
  conversationId: string,
  lastReadSeq: number
): Promise<void> => {
  await ApiService.request(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ lastReadSeq }),
  });
};
