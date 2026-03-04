/**
 * useTheme Hook
 * 
 * 简化主题访问的 Hook
 * 
 * 用法：
 * ```tsx
 * import { useTheme } from '@/hooks/useTheme';
 * 
 * const MyComponent = () => {
 *   const { colors, spacing, shadows, typography } = useTheme();
 *   
 *   return (
 *     <View style={{ 
 *       backgroundColor: colors.primary,
 *       padding: spacing.md,
 *       ...shadows.card 
 *     }}>
 *       <Text style={{ color: colors.textPrimary }}>Hello</Text>
 *     </View>
 *   );
 * };
 * ```
 */

import { useMemo } from 'react';
import { theme as defaultTheme } from '../theme';
import { useThemeContext } from '../contexts/ThemeContext';
import type { Theme } from '../theme/types';

/**
 * 主题 Hook 返回值
 */
interface UseThemeReturn extends Theme {
  /** 是否为暗色模式 */
  isDark: boolean;
  /** 切换暗色模式 */
  toggleDarkMode: () => void;
}

/**
 * 使用主题
 * 
 * @returns 主题对象和暗色模式控制方法
 */
export const useTheme = (): UseThemeReturn => {
  const { theme, isDark, toggleDarkMode } = useThemeContext();

  // 使用 useMemo 缓存结果
  return useMemo(
    () => ({
      ...theme,
      isDark,
      toggleDarkMode,
    }),
    [theme, isDark, toggleDarkMode]
  );
};

/**
 * 仅获取主题（不包含暗色模式控制）
 * 
 * @returns 主题对象
 */
export const useThemeOnly = (): Theme => {
  const { theme } = useThemeContext();
  return theme;
};

/**
 * 快速访问颜色
 * 
 * @returns 颜色对象
 */
export const useColors = () => {
  const { theme } = useThemeContext();
  return theme.colors;
};

/**
 * 快速访问间距
 * 
 * @returns 间距对象
 */
export const useSpacing = () => {
  const { theme } = useThemeContext();
  return theme.spacing;
};

/**
 * 快速访问阴影
 * 
 * @returns 阴影对象
 */
export const useShadows = () => {
  const { theme } = useThemeContext();
  return theme.shadows;
};

/**
 * 快速访问字体排印
 * 
 * @returns 字体排印对象
 */
export const useTypography = () => {
  const { theme } = useThemeContext();
  return theme.typography;
};

export default useTheme;
