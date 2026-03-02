# ChatDetailScreen 导入路径修复指南

## 问题
ChatDetailScreen.tsx 移动到 `src/screens/ChatDetailScreen/index.tsx` 后，所有导入路径都需要调整。

## 需要修复的路径

在 `src/screens/ChatDetailScreen/index.tsx` 文件中，批量替换：

### VSCode 批量替换

1. 打开文件 `src/screens/ChatDetailScreen/index.tsx`
2. 按 `Cmd+H` (Mac) 或 `Ctrl+H` (Windows) 打开替换
3. 启用正则表达式模式（.* 图标）
4. 执行以下替换：

| 查找 | 替换为 |
|------|--------|
| `from '\.\./database` | `from '../../database` |
| `from '\.\./config` | `from '../../config` |
| `from '\.\./services` | `from '../../services` |
| `from '\.\./types` | `from '../../types` |
| `from '\.\./utils` | `from '../../utils` |
| `from '\.\./api` | `from '../../api` |
| `from '\.\./contexts` | `from '../../contexts` |
| `from '\.\./components` | `from '../../components` |

### 或使用 sed 命令（Mac/Linux）

```bash
cd /Users/jinjunjie/github/EchoEnglish

# 备份原文件
cp src/screens/ChatDetailScreen/index.tsx src/screens/ChatDetailScreen/index.tsx.bak

# 批量替换
sed -i '' "s/from '\.\.\/database/from '..\/..\/database/g" src/screens/ChatDetailScreen/index.tsx
sed -i '' "s/from '\.\.\/config/from '..\/..\/config/g" src/screens/ChatDetailScreen/index.tsx
sed -i '' "s/from '\.\.\/services/from '..\/..\/services/g" src/screens/ChatDetailScreen/index.tsx
sed -i '' "s/from '\.\.\/types/from '..\/..\/types/g" src/screens/ChatDetailScreen/index.tsx
sed -i '' "s/from '\.\.\/utils/from '..\/..\/utils/g" src/screens/ChatDetailScreen/index.tsx
sed -i '' "s/from '\.\.\/api/from '..\/..\/api/g" src/screens/ChatDetailScreen/index.tsx
sed -i '' "s/from '\.\.\/contexts/from '..\/..\/contexts/g" src/screens/ChatDetailScreen/index.tsx
sed -i '' "s/from '\.\.\/components/from '..\/..\/components/g" src/screens/ChatDetailScreen/index.tsx
```

## 验证

替换完成后，运行 TypeScript 检查：

```bash
npx tsc --noEmit
```

应该没有 `Cannot find module` 错误。

## 其他修复

如果还有 `implicitly has an 'any' type` 错误，需要添加类型注解：

```typescript
// 错误
.map(m => ({ ... }))

// 正确
.map((m: any) => ({ ... }))
```
