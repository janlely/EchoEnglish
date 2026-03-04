/**
 * 主题系统导出
 * 
 * 商务极简风格主题
 * 
 * 使用示例：
 * ```tsx
 * import { theme, colors, spacing, shadows, typography } from '@/theme';
 * 
 * // 使用完整主题
 * const { colors, spacing, shadows } = theme;
 * 
 * // 或使用单独模块
 * backgroundColor: colors.primary
 * padding: spacing.md
 * ```
 */

// 导出颜色
export { colors } from './colors';
export type { Colors } from './colors';

// 导出字体排印
export { typography } from './typography';
export type { Typography } from './typography';

// 导出间距
export { spacing } from './spacing';
export type { Spacing } from './spacing';

// 导出阴影
export { shadows } from './shadows';
export type { Shadows } from './shadows';

// 导出类型
export type { Theme, ThemeContextType, ThemeConfig, WithThemeProps } from './types';

// 默认主题对象
import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { shadows } from './shadows';

export const theme = {
  colors,
  typography,
  spacing,
  shadows,
  darkMode: false,
};

export default theme;
