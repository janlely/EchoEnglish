# 主题系统使用指南

## 快速开始

### 1. 导入 useTheme Hook

```tsx
import { useTheme } from '../hooks/useTheme';
```

### 2. 在组件中使用

```tsx
const MyComponent = () => {
  const { colors, spacing, typography, shadows, isDark, toggleDarkMode } = useTheme();
  
  return (
    <View style={{ 
      backgroundColor: colors.background,
      padding: spacing.md,
      ...shadows.card,
    }}>
      <Text style={{ color: colors.textPrimary, ...typography.body }}>
        Hello
      </Text>
    </View>
  );
};
```

## 主题变量

### 颜色 (colors)

| 变量 | 值 | 用途 |
|------|------|------|
| `colors.primary` | `#1A56DB` | 主色调 - 按钮、链接 |
| `colors.primaryLight` | `#DBEAFE` | 浅蓝 - hover 背景 |
| `colors.background` | `#F9FAFB` | 页面背景 |
| `colors.surface` | `#FFFFFF` | 卡片背景 |
| `colors.textPrimary` | `#111827` | 主文字 |
| `colors.textSecondary` | `#6B7280` | 次级文字 |
| `colors.textTertiary` | `#9CA3AF` | 提示文字 |
| `colors.border` | `#E5E7EB` | 边框 |
| `colors.success` | `#059669` | 成功 |
| `colors.error` | `#DC2626` | 错误 |
| `colors.warning` | `#D97706` | 警告 |

### 间距 (spacing)

| 变量 | 值 | 用途 |
|------|------|------|
| `spacing.xs` | 8 | 小间距 |
| `spacing.sm` | 12 | 中小间距 |
| `spacing.md` | 16 | 基础间距 |
| `spacing.lg` | 24 | 大间距 |
| `spacing.xl` | 32 | 超大间距 |

### 字体 (typography)

```tsx
// 使用预设样式
{...typography.title1}  // 24px, bold
{...typography.title2}  // 20px, semibold
{...typography.title3}  // 18px, semibold
{...typography.body}    // 16px, normal
{...typography.button}  // 16px, semibold
{...typography.caption} // 12px, normal
```

### 阴影 (shadows)

```tsx
{...shadows.sm}    // 小阴影
{...shadows.md}    // 中阴影 - 卡片
{...shadows.lg}    // 大阴影 - 浮层
{...shadows.xl}    // 超大阴影 - 模态框
```

## 样式重构步骤

### Step 1: 移除硬编码颜色

```tsx
// ❌ 之前
backgroundColor: '#007AFF'
color: '#333'
padding: 16
```

```tsx
// ✅ 之后
backgroundColor: colors.primary
color: colors.textPrimary
padding: spacing.md
```

### Step 2: 简化 StyleSheet

```tsx
// ❌ 之前
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f8f8',
  },
  text: {
    color: '#333',
    fontSize: 16,
  },
});
```

```tsx
// ✅ 之后
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    fontSize: 16,
  },
});

// 在组件中使用
<View style={[styles.container, { backgroundColor: colors.background }]}>
  <Text style={[styles.text, { color: colors.textPrimary }]}>
```

## 已完成的页面

- ✅ App.tsx
- ✅ MainScreen.tsx
- ✅ ProfileScreen.tsx
- ✅ LoginScreen.tsx
- ✅ MessageBubble.tsx (ChatDetailScreen)

## 待重构的页面

- ⏳ RegisterScreen.tsx
- ⏳ SearchUserScreen.tsx
- ⏳ ContactsScreen.tsx
- ⏳ FriendRequestsScreen.tsx
- ⏳ CreateGroupChatScreen.tsx
- ⏳ VerifyEmailScreen.tsx
- ⏳ ChatDetailScreen/index.tsx
- ⏳ 通用组件 (TranslationAssistantModal, AvatarCropper 等)
