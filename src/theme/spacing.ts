/**
 * 间距系统
 * 
 * 基于 4px 网格系统
 * 所有间距值都是 4 的倍数，确保视觉一致性
 */

export const spacing = {
  // ========== 基础间距 (基于 4px 网格) ==========
  0: 0,
  1: 4,    // 1 unit
  2: 8,    // 2 units
  3: 12,   // 3 units
  4: 16,   // 4 units - 基础间距
  5: 20,   // 5 units
  6: 24,   // 6 units
  8: 32,   // 8 units
  10: 40,  // 10 units
  12: 48,  // 12 units
  16: 64,  // 16 units
  20: 80,  // 20 units
  24: 96,  // 24 units
  
  // ========== 语义化间距 ==========
  /** 超紧凑间距 - 用于紧密相关的元素 */
  xxs: 4,
  
  /** 紧凑间距 - 用于相关元素 */
  xs: 8,
  
  /** 小间距 - 用于组内元素 */
  sm: 12,
  
  /** 基础间距 - 默认间距 */
  md: 16,
  
  /** 大间距 - 用于分组 */
  lg: 24,
  
  /** 超大间距 - 用于大分组 */
  xl: 32,
  
  /** 特大间距 - 用于页面级分隔 */
  '2xl': 40,
  
  '3xl': 48,
  
  // ========== 页面边距 ==========
  pagePadding: 16,      // 页面左右边距
  pagePaddingSm: 12,    // 小页面边距
  pagePaddingLg: 24,    // 大页面边距
  
  // ========== 卡片内边距 ==========
  cardPadding: 16,      // 卡片内边距
  cardPaddingSm: 12,    // 小卡片内边距
  cardPaddingLg: 24,    // 大卡片内边距
  
  // ========== 按钮内边距 ==========
  buttonPaddingX: 20,   // 按钮水平内边距
  buttonPaddingY: 12,   // 按钮垂直内边距
  buttonPaddingXSm: 16, // 小按钮水平内边距
  buttonPaddingYSm: 8,  // 小按钮垂直内边距
  
  // ========== 输入框内边距 ==========
  inputPaddingX: 16,    // 输入框水平内边距
  inputPaddingY: 12,    // 输入框垂直内边距
  
  // ========== 列表项内边距 ==========
  listItemPaddingX: 16, // 列表项水平内边距
  listItemPaddingY: 12, // 列表项垂直内边距
  
  // ========== 图标间距 ==========
  iconMargin: 8,        // 图标与文字间距
  iconMarginSm: 4,      // 小图标间距
  iconMarginLg: 12,     // 大图标间距
  
  // ========== 头像尺寸 ==========
  avatarXs: 24,         // 超小头像
  avatarSm: 32,         // 小头像
  avatarMd: 40,         // 中等头像
  avatarLg: 48,         // 大头像
  avatarXl: 56,         // 超大头像
  avatar2Xl: 80,        // 特大头像
  
  // ========== 圆角 ==========
  radiusNone: 0,        // 无圆角
  radiusSm: 4,          // 小圆角
  radiusMd: 8,          // 中等圆角 - 按钮
  radiusLg: 12,         // 大圆角 - 卡片
  radiusXl: 16,         // 超大圆角
  radius2Xl: 24,        // 特大圆角 - 头像
  radiusFull: 9999,     // 完全圆形
} as const;

export type Spacing = typeof spacing;

export default spacing;
