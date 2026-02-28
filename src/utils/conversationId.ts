/**
 * Generate conversation ID for direct chat
 * Formula: min(uid1, uid2) + '_' + max(uid1, uid2)
 * This ensures the conversation ID is the same regardless of the order of user IDs
 */
export function generateDirectConversationId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

/**
 * Generate conversation ID for group chat
 * Formula: group_${groupId}
 */
export function generateGroupConversationId(groupId: string): string {
  return `group_${groupId}`;
}

/**
 * Generate conversation ID based on chat type
 */
export function generateConversationId(
  uid1: string,
  uid2: string,
  chatType: 'direct' | 'group'
): string {
  if (chatType === 'group') {
    return generateGroupConversationId(uid2); // uid2 is the group ID
  }
  return generateDirectConversationId(uid1, uid2);
}

/**
 * Check if a conversation ID is for a group chat
 */
export function isGroupConversation(conversationId: string): boolean {
  return conversationId.startsWith('group_');
}

/**
 * Extract the other user ID from a conversation ID for direct chat
 * Returns null if it's a group conversation
 */
export function getOtherUserIdFromConversationId(
  conversationId: string,
  currentUserId: string
): string | null {
  if (isGroupConversation(conversationId)) {
    return null;
  }
  
  const [uid1, uid2] = conversationId.split('_');
  return uid1 === currentUserId ? uid2 : uid1;
}

/**
 * Get current user ID from conversation ID for direct chat
 */
export function getCurrentUserIdFromConversationId(
  conversationId: string,
  otherUserId: string
): string {
  if (isGroupConversation(conversationId)) {
    return otherUserId; // For group chat, return the provided userId
  }
  
  const [uid1, uid2] = conversationId.split('_');
  return uid1 === otherUserId ? uid2 : uid1;
}
