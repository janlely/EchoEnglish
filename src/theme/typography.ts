/**
 * 字体排印系统
 * 
 * 基于 iOS/Android 系统字体
 * 使用动态字体大小支持可访问性
 */

export const typography = {
  // ========== 字体系列 ==========
  fontFamily: {
    regular: 'System',           // 系统默认字体
    medium: 'System',            // 中等字重
    semibold: 'System',          // 半粗体
    bold: 'System',              // 粗体
  },
  
  // ========== 字重 ==========
  fontWeight: {
    regular: '400' as '400',
    medium: '500' as '500',
    semibold: '600' as '600',
    bold: '700' as '700',
  },
  
  // ========== 字体大小 (基于 16px 基准) ==========
  fontSize: {
    xs: 10,      // 超小 - 辅助文字
    sm: 12,      // 小 - 次要信息
    base: 14,    // 基础 - 正文
    lg: 16,      // 大 - 重要正文
    xl: 18,      // 超大 - 小标题
    '2xl': 20,  // 标题
    '3xl': 24,  // 大标题
    '4xl': 32,  // 超大标题
  },
  
  // ========== 行高 ==========
  lineHeight: {
    none: 12,
    tight: 16,
    normal: 20,
    relaxed: 24,
    loose: 28,
  },
  
  // ========== 字间距 ==========
  letterSpacing: {
    tighter: -0.8,
    tight: -0.4,
    normal: 0,
    wide: 0.4,
    wider: 0.8,
  },
  
  // ========== 预设文本样式 ==========
  /** 大标题 - 用于页面标题 */
  largeTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as '700',
    letterSpacing: 0,
  },
  
  /** 标题 1 - 用于 Section 标题 */
  title1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as '700',
    letterSpacing: 0,
  },
  
  /** 标题 2 - 用于卡片标题 */
  title2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as '600',
    letterSpacing: 0,
  },
  
  /** 标题 3 - 用于子标题 */
  title3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as '600',
    letterSpacing: 0,
  },
  
  /** 正文 - 用于主要内容 */
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as '400',
    letterSpacing: 0,
  },
  
  /** 次要正文 - 用于次要内容 */
  bodySecondary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as '400',
    letterSpacing: 0,
  },
  
  /** 按钮文字 */
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as '600',
    letterSpacing: 0,
  },
  
  /** 标签文字 */
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as '500',
    letterSpacing: 0.2,
  },
  
  /** 说明文字 */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as '400',
    letterSpacing: 0.2,
  },
  
  /** 时间戳/元信息 */
  footnote: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as '400',
    letterSpacing: 0.2,
  },
} as const;

export type Typography = typeof typography;

export default typography;
