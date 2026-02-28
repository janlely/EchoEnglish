/**
 * Tests for Conversations API
 * Tests conversation list, info, and read status operations
 */

import {
  getConversationsWithUnread,
  getConversationInfo,
  updateReadStatus,
} from '../../src/api/conversations';
import { ApiService } from '../../src/services/ApiService';

// Mock ApiService
jest.mock('../../src/services/ApiService');
const mockedApiService = ApiService as jest.Mocked<typeof ApiService>;

describe('Conversations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getConversationsWithUnread', () => {
    it('should return conversations with unread messages', async () => {
      const mockConversations = [
        {
          conversationId: 'user_a_user_b',
          type: 'direct' as const,
          targetId: 'user_b',
          name: 'User B',
          unreadCount: 3,
        },
        {
          conversationId: 'group_g1',
          type: 'group' as const,
          targetId: 'g1',
          name: 'Group Chat',
          unreadCount: 5,
        },
      ];

      mockedApiService.request.mockResolvedValue({
        success: true,
        data: { conversations: mockConversations },
      });

      const result = await getConversationsWithUnread();

      expect(mockedApiService.request).toHaveBeenCalledWith(
        '/api/conversations/with-unread'
      );
      expect(result).toEqual(mockConversations);
    });

    it('should return empty array when no unread conversations', async () => {
      mockedApiService.request.mockResolvedValue({
        success: true,
        data: { conversations: [] },
      });

      const result = await getConversationsWithUnread();

      expect(result).toEqual([]);
    });
  });

  describe('getConversationInfo', () => {
    it('should return conversation info for direct chat', async () => {
      const mockInfo = {
        conversationId: 'user_a_user_b',
        type: 'direct' as const,
        targetId: 'user_b',
        name: 'User B',
        avatarUrl: 'https://example.com/avatar.png',
        unreadCount: 0,
      };

      mockedApiService.request.mockResolvedValue({
        success: true,
        data: mockInfo,
      });

      const result = await getConversationInfo('user_a_user_b');

      expect(mockedApiService.request).toHaveBeenCalledWith(
        '/api/conversations/user_a_user_b/info'
      );
      expect(result).toEqual(mockInfo);
    });

    it('should return conversation info for group chat', async () => {
      const mockInfo = {
        conversationId: 'group_g1',
        type: 'group' as const,
        targetId: 'g1',
        name: 'Group Chat',
        avatarUrl: 'https://example.com/group-avatar.png',
        unreadCount: 2,
      };

      mockedApiService.request.mockResolvedValue({
        success: true,
        data: mockInfo,
      });

      const result = await getConversationInfo('group_g1');

      expect(mockedApiService.request).toHaveBeenCalledWith(
        '/api/conversations/group_g1/info'
      );
      expect(result).toEqual(mockInfo);
    });
  });

  describe('updateReadStatus', () => {
    it('should update read status with last read message ID', async () => {
      mockedApiService.request.mockResolvedValue({ success: true });

      await updateReadStatus('user_a_user_b', 'msg_123');

      expect(mockedApiService.request).toHaveBeenCalledWith(
        '/api/conversations/user_a_user_b/read',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ lastReadMsgId: 'msg_123' }),
        })
      );
    });

    it('should update read status for group chat', async () => {
      mockedApiService.request.mockResolvedValue({ success: true });

      await updateReadStatus('group_g1', 'msg_456');

      expect(mockedApiService.request).toHaveBeenCalledWith(
        '/api/conversations/group_g1/read',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ lastReadMsgId: 'msg_456' }),
        })
      );
    });
  });
});
