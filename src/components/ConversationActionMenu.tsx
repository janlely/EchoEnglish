/**
 * ConversationActionMenu - 会话操作菜单组件
 * 用于长按会话列表项时显示操作选项（置顶/取消置顶、删除）
 */

import React, { useRef } from 'react';
import { View } from 'react-native';
import BubbleMenu, { BubbleMenuItem } from './BubbleMenu';

export type ConversationMenuAction = 'pin' | 'unpin' | 'delete';

interface ConversationActionMenuProps {
  visible: boolean;
  conversationId: string;
  isPinned: boolean;
  onPress: (action: ConversationMenuAction) => void;
  onClose: () => void;
  // 锚点 ref（会话列表项的位置）
  anchorRef?: React.RefObject<any>;
  // 锚点位置信息（用于计算菜单显示位置）
  anchorPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const ConversationActionMenu: React.FC<ConversationActionMenuProps> = ({
  visible,
  isPinned,
  onPress,
  onClose,
  anchorRef,
  anchorPosition,
}) => {
  const internalRef = useRef<View>(null);
  const ref = anchorRef || internalRef;

  const items: BubbleMenuItem[] = [
    {
      id: isPinned ? 'unpin' : 'pin',
      label: isPinned ? '📌 取消置顶' : '📌 置顶聊天',
      onPress: () => onPress(isPinned ? 'unpin' : 'pin'),
    },
    {
      id: 'delete',
      label: '🗑️ 删除聊天',
      onPress: () => onPress('delete'),
    },
  ];

  // 根据锚点位置决定菜单显示位置
  // 如果锚点在屏幕下半部分（y > 屏幕一半），菜单显示在上方；否则显示在下方
  const placement = anchorPosition && anchorPosition.y > 400 ? 'top' : 'bottom';

  return (
    <BubbleMenu
      isVisible={visible}
      onClose={onClose}
      fromRef={ref}
      showArrow={true}
      placement={placement}
      items={items}
    />
  );
};

export default ConversationActionMenu;
