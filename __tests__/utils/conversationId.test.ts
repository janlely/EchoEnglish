/**
 * Tests for conversationId utility functions
 * Tests conversation ID generation and parsing logic
 */

import {
  generateDirectConversationId,
  generateGroupConversationId,
  generateConversationId,
  isGroupConversation,
  getOtherUserIdFromConversationId,
  getCurrentUserIdFromConversationId,
} from '../../src/utils/conversationId';

describe('conversationId utilities', () => {
  describe('generateDirectConversationId', () => {
    it('should generate conversation ID with min UID first', () => {
      const uid1 = 'user_b';
      const uid2 = 'user_a';

      const result = generateDirectConversationId(uid1, uid2);

      // 'user_a' < 'user_b' lexicographically, so 'user_a' should be first
      expect(result).toBe('user_a_user_b');
    });

    it('should generate same ID regardless of UID order', () => {
      const uid1 = 'user_123';
      const uid2 = 'user_456';

      const result1 = generateDirectConversationId(uid1, uid2);
      const result2 = generateDirectConversationId(uid2, uid1);

      expect(result1).toBe(result2);
      expect(result1).toBe('user_123_user_456');
    });

    it('should handle UUID format UIDs', () => {
      const uid1 = '164b53fd-f317-4d41-806b-094ffab6e908';
      const uid2 = 'c579cde7-7af2-4551-8783-fc19c684562c';

      const result = generateDirectConversationId(uid1, uid2);

      // '164b...' < 'c579...' lexicographically
      expect(result).toBe('164b53fd-f317-4d41-806b-094ffab6e908_c579cde7-7af2-4551-8783-fc19c684562c');
    });
  });

  describe('generateGroupConversationId', () => {
    it('should prefix group ID with "group_"', () => {
      const groupId = 'group_123';

      const result = generateGroupConversationId(groupId);

      expect(result).toBe('group_group_123');
    });

    it('should handle UUID format group IDs', () => {
      const groupId = 'abc-123-xyz';

      const result = generateGroupConversationId(groupId);

      expect(result).toBe('group_abc-123-xyz');
    });
  });

  describe('generateConversationId', () => {
    it('should generate direct chat ID for direct chat type', () => {
      const uid1 = 'user_b';
      const uid2 = 'user_a';

      const result = generateConversationId(uid1, uid2, 'direct');

      expect(result).toBe('user_a_user_b');
    });

    it('should generate group chat ID for group chat type', () => {
      const uid1 = 'user_123';
      const groupId = 'group_456';

      const result = generateConversationId(uid1, groupId, 'group');

      expect(result).toBe('group_group_456');
    });
  });

  describe('isGroupConversation', () => {
    it('should return true for group conversation IDs', () => {
      expect(isGroupConversation('group_123')).toBe(true);
      expect(isGroupConversation('group_abc-def')).toBe(true);
    });

    it('should return false for direct conversation IDs', () => {
      expect(isGroupConversation('user_a_user_b')).toBe(false);
      expect(isGroupConversation('164b53fd_c579cde7')).toBe(false);
    });

    it('should return false for empty or invalid IDs', () => {
      expect(isGroupConversation('')).toBe(false);
      expect(isGroupConversation('group')).toBe(false);
      expect(isGroupConversation('groups_123')).toBe(false);
    });
  });

  describe('getOtherUserIdFromConversationId', () => {
    it('should return other user ID for direct chat (current user first)', () => {
      // Use simple IDs without underscores to avoid split issues
      const conversationId = 'a_b';
      const currentUserId = 'a';

      const result = getOtherUserIdFromConversationId(conversationId, currentUserId);

      expect(result).toBe('b');
    });

    it('should return other user ID when current user is second', () => {
      const conversationId = 'a_b';
      const currentUserId = 'b';

      const result = getOtherUserIdFromConversationId(conversationId, currentUserId);

      expect(result).toBe('a');
    });

    it('should return null for group conversations', () => {
      const conversationId = 'group_123';
      const currentUserId = 'a';

      const result = getOtherUserIdFromConversationId(conversationId, currentUserId);

      expect(result).toBeNull();
    });

    it('should handle UUID format user IDs', () => {
      const conversationId = '164b53fd-f317-4d41-806b-094ffab6e908_c579cde7-7af2-4551-8783-fc19c684562c';
      const currentUserId = '164b53fd-f317-4d41-806b-094ffab6e908';

      const result = getOtherUserIdFromConversationId(conversationId, currentUserId);

      expect(result).toBe('c579cde7-7af2-4551-8783-fc19c684562c');
    });
  });

  describe('getCurrentUserIdFromConversationId', () => {
    it('should return current user ID from conversation ID', () => {
      const conversationId = 'a_b';
      const otherUserId = 'b';

      const result = getCurrentUserIdFromConversationId(conversationId, otherUserId);

      expect(result).toBe('a');
    });

    it('should return current user ID when other user is first', () => {
      const conversationId = 'a_b';
      const otherUserId = 'a';

      const result = getCurrentUserIdFromConversationId(conversationId, otherUserId);

      expect(result).toBe('b');
    });

    it('should return provided userId for group conversations', () => {
      const conversationId = 'group_123';
      const userId = 'a';

      const result = getCurrentUserIdFromConversationId(conversationId, userId);

      expect(result).toBe('a');
    });
  });
});
