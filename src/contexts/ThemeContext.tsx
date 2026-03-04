/**
 * 主题上下文
 *
 * 提供主题变量到整个应用
 * 支持未来暗色模式扩展
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { theme as defaultTheme } from '../theme';
import type { Theme, ThemeConfig } from '../theme/types';

// 创建主题上下文
interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleDarkMode: () => void;
  setTheme: (config: ThemeConfig) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// 主题提供者 Props
interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * 主题提供者组件
 *
 * 用法：
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isDark, setIsDark] = useState(false);

  // 切换暗色模式
  const toggleDarkMode = useCallback(() => {
    setIsDark((prev) => !prev);
    // TODO: 未来实现暗色主题时，在这里切换主题配置
  }, []);

  // 设置主题配置
  const setTheme = useCallback((config: ThemeConfig) => {
    setThemeState((prev) => ({
      ...prev,
      colors: config.colors ? { ...prev.colors, ...config.colors } : prev.colors,
      typography: config.typography ? { ...prev.typography, ...config.typography } : prev.typography,
      spacing: config.spacing ? { ...prev.spacing, ...config.spacing } : prev.spacing,
      shadows: config.shadows ? { ...prev.shadows, ...config.shadows } : prev.shadows,
    }));
  }, []);

  const value: ThemeContextValue = {
    theme,
    isDark,
    toggleDarkMode,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * 获取主题上下文
 * 
 * 用法：
 * ```tsx
 * const { theme, isDark, toggleDarkMode } = useThemeContext();
 * ```
 */
export const useThemeContext = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
