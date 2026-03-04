/**
 * 主题类型定义
 */

import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { shadows } from './shadows';

/**
 * 颜色类型
 */
export type Colors = typeof colors;

/**
 * 字体排印类型
 */
export type Typography = typeof typography;

/**
 * 间距类型
 */
export type Spacing = typeof spacing;

/**
 * 阴影类型
 */
export type Shadows = typeof shadows;

/**
 * 完整主题类型
 */
export interface Theme {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  shadows: Shadows;
  darkMode: boolean;
}

/**
 * 主题上下文类型
 */
export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleDarkMode: () => void;
  setTheme: (theme: Partial<Theme>) => void;
}

/**
 * 主题配置类型（用于自定义主题）
 */
export interface ThemeConfig {
  colors?: Partial<Colors>;
  typography?: Partial<Typography>;
  spacing?: Partial<Spacing>;
  shadows?: Partial<Shadows>;
}

/**
 * 主题组件 Props 类型
 */
export interface WithThemeProps {
  theme: Theme;
}

// 导出默认类型
export type { Colors as ColorsType, Typography as TypographyType, Spacing as SpacingType, Shadows as ShadowsType };

export default Theme;
