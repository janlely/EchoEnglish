/**
 * 阴影系统
 * 
 * 商务极简风格使用微妙的阴影创建层次感
 * 避免过重的阴影，保持干净利落的视觉效果
 */

export const shadows = {
  // ========== 基础阴影 ==========
  /** 无阴影 */
  none: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  /** 超小阴影 - 用于微妙的边界 */
  xs: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  /** 小阴影 - 用于按钮、输入框 */
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  
  /** 中等阴影 - 用于卡片 */
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  /** 大阴影 - 用于浮层、下拉菜单 */
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  
  /** 超大阴影 - 用于模态框、Popover */
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  
  /** 特大阴影 - 用于重要浮层 */
  '2xl': {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  
  // ========== 语义化阴影 ==========
  /** 按钮阴影 */
  button: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  /** 按钮按压阴影 */
  buttonPressed: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  
  /** 卡片阴影 */
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  
  /** 悬浮卡片阴影 */
  cardHover: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  
  /** 下拉菜单阴影 */
  dropdown: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  
  /** 模态框阴影 */
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  
  /** 气泡菜单阴影 */
  popover: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  
  /** 输入框阴影 */
  input: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  /** 输入框聚焦阴影 */
  inputFocused: {
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  
  /** 头像阴影 */
  avatar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  /** 徽章阴影 */
  badge: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
} as const;

export type Shadows = typeof shadows;

export default shadows;
