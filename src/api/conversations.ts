import { ApiService } from '../services/ApiService';

export interface ConversationInfo {
  conversationId: string;
  type: 'direct' | 'group';
  targetId: string;
  name: string;
  avatarUrl?: string | null;
  unreadCount: number;
  lastReadMsgId?: string | null;
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
  lastReadMsgId: string
): Promise<void> => {
  await ApiService.request(`/api/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ lastReadMsgId }),
  });
};
