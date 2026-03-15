/**
 * BubbleMenu - 气泡菜单组件
 * 基于 react-native-popover-view 实现
 *
 * 特性：
 * - 箭头自动指向触发元素
 * - 支持自定义箭头位置
 * - 自动检测边界并调整位置
 * - 支持 WeChat 风格的圆角气泡样式
 * - 支持横向和纵向布局
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Popover from 'react-native-popover-view';

export interface BubbleMenuItem {
  id: string;
  label: string;
  icon?: string;
  onPress?: () => void;
}

export interface BubbleMenuProps {
  isVisible: boolean;
  onClose: () => void;
  items: BubbleMenuItem[];
  // 触发元素（可以是 ref 或者 render 函数）
  fromRef?: React.RefObject<any>;
  // 自定义菜单内容
  children?: React.ReactNode;
  // 箭头是否显示
  showArrow?: boolean;
  // 放置位置：'auto' | 'top' | 'bottom' | 'left' | 'right' | 'floating'
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'floating';
  // 布局方向：纵向 | 横向
  layout?: 'vertical' | 'horizontal';
  // 自定义样式
  menuStyle?: StyleProp<ViewStyle>;
  // 背景颜色
  backgroundColor?: string;
  // 圆角
  borderRadius?: number;
  // 是否显示遮罩
  showOverlay?: boolean;
  // 偏移量
  offset?: number;
}

const BubbleMenu: React.FC<BubbleMenuProps> = ({
  isVisible,
  onClose,
  items,
  fromRef,
  children,
  showArrow = true,
  placement = 'auto',
  layout = 'vertical',
  menuStyle,
  backgroundColor = '#ffffff',
  borderRadius = 12,
  showOverlay = true,
  offset = 0,
}) => {
  // 创建一个内部 ref 用于内部使用
  const internalRef = useRef<any>(null);

  // 使用传入的 fromRef 或内部 ref
  const effectiveRef = fromRef || internalRef;

  const isHorizontal = layout === 'horizontal';

  return (
    <Popover
      isVisible={isVisible}
      from={effectiveRef}
      onRequestClose={onClose}
      placement={'auto' as any}
      popoverStyle={[
        styles.popover,
        { backgroundColor, borderRadius },
        isHorizontal && styles.popoverHorizontal,
        menuStyle,
      ]}
      backgroundStyle={showOverlay ? { backgroundColor: 'rgba(0, 0, 0, 0.4)' } : { backgroundColor: 'transparent' }}
      arrowSize={showArrow ? { width: 16, height: 8 } : { width: 0, height: 0 }}
      offset={offset}
    >
      {children ? (
        children
      ) : (
        <View style={[styles.menuContent, isHorizontal && styles.menuContentHorizontal]}>
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && (
                <View
                  style={[
                    isHorizontal ? styles.separatorHorizontal : styles.separator,
                    isHorizontal && { height: '60%', alignSelf: 'center' }
                  ]}
                />
              )}
              <TouchableOpacity
                style={[styles.menuItem, isHorizontal && styles.menuItemHorizontal]}
                onPress={() => {
                  item.onPress?.();
                  onClose();
                }}
              >
                {item.icon && <Text style={styles.menuItemIcon}>{item.icon}</Text>}
                <Text style={styles.menuItemLabel}>{item.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      )}
    </Popover>
  );
};

const styles = StyleSheet.create({
  popover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    padding: 0,
    minWidth: 150,
  },
  popoverHorizontal: {
    minWidth: 0,
  },
  menuContent: {
    paddingVertical: 8,
  },
  menuContentHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 120,
  },
  menuItemHorizontal: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 0,
  },
  menuItemIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  menuItemLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
  },
  separatorHorizontal: {
    width: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 2,
  },
});

export default BubbleMenu;
