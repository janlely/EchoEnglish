/**
 * ChatDetailScreen 类型定义
 */

export interface MessageInterface {
  id: string;
  msgId?: string;
  text: string;
  sender: 'me' | 'other';
  senderId?: string;
  senderAvatar?: string;
  timestamp: string;
  sending?: boolean;
  failed?: boolean;
}

export interface SelectedMessage {
  id: string;
  msgId: string;
  text: string;
}

export type ChatType = 'direct' | 'group';

export type MenuAction = 'translate' | 'copy';