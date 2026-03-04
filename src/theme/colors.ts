/**
 * 商务极简风格配色方案
 * 
 * 设计理念：
 * - 主色调：沉稳的深蓝色，传达专业、信任
 * - 中性色：温暖的灰色系，避免纯黑白
 * - 功能色：低饱和度的成功/警告/错误色
 */

export const colors = {
  // ========== 主色调 ==========
  primary: '#1A56DB',        // 商务深蓝 - 主按钮、重要元素
  primaryLight: '#DBEAFE',   // 浅蓝 - hover 背景、选中状态
  primaryDark: '#1E40AF',    // 深蓝 - 按压状态
  
  // ========== 中性色 - 背景 ==========
  background: '#F9FAFB',     // 页面背景
  surface: '#FFFFFF',        // 卡片、浮层背景
  surfaceElevated: '#FFFFFF', //  elevated 表面（带阴影）
  
  // ========== 中性色 - 边框/分割线 ==========
  border: '#E5E7EB',         // 边框
  borderLight: '#F3F4F6',    // 浅边框
  divider: '#E5E7EB',        // 分割线
  
  // ========== 中性色 - 文字 ==========
  textPrimary: '#111827',    // 主文字（深灰近黑）
  textSecondary: '#6B7280',  // 次级文字
  textTertiary: '#9CA3AF',   // 提示文字
  textDisabled: '#D1D5DB',   // 禁用文字
  
  // ========== 功能色 - 成功 ==========
  success: '#059669',        // 祖母绿 - 成功状态
  successLight: '#D1FAE5',   // 浅绿背景
  successDark: '#047857',    // 深绿
  
  // ========== 功能色 - 警告 ==========
  warning: '#D97706',        // 琥珀色 - 警告状态
  warningLight: '#FEF3C7',   // 浅黄背景
  warningDark: '#B45309',    // 深琥珀
  
  // ========== 功能色 - 错误 ==========
  error: '#DC2626',          // 深红 - 错误状态
  errorLight: '#FEE2E2',     // 浅红背景
  errorDark: '#B91C1C',      // 深红
  
  // ========== 功能色 - 信息 ==========
  info: '#2563EB',           // 蓝色 - 信息提示
  infoLight: '#DBEAFE',      // 浅蓝背景
  infoDark: '#1E40AF',       // 深蓝
  
  // ========== 头像占位色 ==========
  avatarPlaceholder: '#E5E7EB',
  
  // ========== 叠加层 ==========
  overlay: 'rgba(0, 0, 0, 0.5)',    // 遮罩层
  overlayLight: 'rgba(0, 0, 0, 0.3)', // 浅遮罩
  
  // ========== 特殊颜色 ==========
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
  
  // ========== 消息气泡颜色 ==========
  messageSent: '#1A56DB',      // 已发送消息背景（深蓝）
  messageReceived: '#FFFFFF',  // 接收消息背景（白色）
  messageTextSent: '#FFFFFF',  // 已发送消息文字
  messageTextReceived: '#111827', // 接收消息文字
  
  // ========== 未读标记 ==========
  unreadBadge: '#1A56DB',      // 未读消息标记
  unreadBadgeText: '#FFFFFF',  // 未读标记文字
  
  // ========== 在线状态 ==========
  online: '#10B981',           // 在线 - 翠绿色
  offline: '#9CA3AF',          // 离线 - 灰色
  busy: '#EF4444',             // 忙碌 - 红色
  away: '#F59E0B',             // 离开 - 黄色
} as const;

export type Colors = typeof colors;

export default colors;
