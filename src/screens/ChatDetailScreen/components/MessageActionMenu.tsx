import React, { useRef } from 'react';
import { View } from 'react-native';
import BubbleMenu, { BubbleMenuItem } from '../../../components/BubbleMenu';

interface MessageActionMenuProps {
  visible: boolean;
  messageText: string;
  messageId: string;
  onPress: (action: 'translate' | 'copy') => void;
  onClose: () => void;
  // 锚点 ref（消息气泡的位置）
  anchorRef?: React.RefObject<any>;
  // 锚点位置信息（用于计算菜单显示位置）
  anchorPosition?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
  visible,
  messageText,
  messageId,
  onPress,
  onClose,
  anchorRef,
  anchorPosition,
}) => {
  const internalRef = useRef<View>(null);
  const ref = anchorRef || internalRef;

  const items: BubbleMenuItem[] = [
    {
      id: 'translate',
      label: '🔤 翻译',
      onPress: () => onPress('translate'),
    },
    {
      id: 'copy',
      label: '📋 复制',
      onPress: () => onPress('copy'),
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

export default MessageActionMenu;
