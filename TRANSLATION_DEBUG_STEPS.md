# 翻译功能调试步骤

## 问题现象
- 前端日志显示事件已发送
- 但没有收到任何后端响应
- 翻译框一直处于 loading 状态

## 已添加的改进

### 1. 前端时序修复
**问题**: 监听器注册和事件发送的时序问题

**修复**: 
```typescript
// 先注册监听器
WebSocketService.on('translate_message_response', handler);

// 稍后发送事件（50ms 延迟）
setTimeout(() => {
  WebSocketService.emit('translate_message', data);
}, 50);
```

### 2. 超时机制
**添加**: 30 秒超时检测
```typescript
const timeoutId = setTimeout(() => {
  setError('翻译超时，请检查网络连接');
  setIsLoading(false);
}, 30000);
```

### 3. 详细日志
**前端**:
- `========== START TRANSLATION ==========`
- `❌ No cache found, requesting from backend...`
- `WebSocket listener registered`
- `📨 Received translation response: {...}`
- `⏰ Translation timeout - no response from backend`

**后端**:
- `========== TRANSLATE MESSAGE REQUEST ==========`
- `Received translate_message from userId: {...}`
- `Fetching message to translate...`
- `Message found: ...`
- `Calling openRouterService.streamTranslate...`
- `Translation stream started`
- `Translation chunk: ...`
- `Translation completed: ...`

## 调试步骤

### 步骤 1: 检查后端日志

运行应用后，**查看后端控制台**，长按消息翻译时应该看到：

```
[WebSocket] ========== TRANSLATE MESSAGE REQUEST ==========
[WebSocket] Received translate_message from user123: {...}
[WebSocket] Fetching message to translate...
[WebSocket] Message found: Hello world
...
```

**如果没有看到任何日志**：
- 后端没有收到 WebSocket 事件
- 检查 WebSocket 连接是否正常
- 检查后端是否正在运行

### 步骤 2: 检查前端日志

应该看到：

```
[MessageTranslateModal] ========== START TRANSLATION ==========
[MessageTranslateModal] ❌ No cache found, requesting from backend...
[WebSocketContext] translate_message_response listener registered
[WebSocketContext] translate_message event emitted
[MessageTranslateModal] WebSocket listener registered
```

**如果 30 秒后看到**：
```
[MessageTranslateModal] ⏰ Translation timeout - no response from backend
```

说明后端没有响应，需要检查后端日志。

### 步骤 3: 检查 WebSocket 连接

在前端控制台查看：
```
✅ WebSocket connected successfully
```

如果没有连接成功，翻译功能无法工作。

### 步骤 4: 检查后端 OpenRouter 配置

后端日志中如果看到：
```
[OpenRouter] Translation API error: 401
```

说明 OpenRouter API key 配置有问题。

## 常见问题

### 问题 1: 后端没有日志
**原因**: WebSocket 未连接或后端未运行

**解决**:
1. 确认后端正在运行：`cd server && npm run dev`
2. 检查前端 WebSocket 连接日志
3. 检查 `.env` 配置

### 问题 2: 后端收到请求但报错
**原因**: 数据库查询失败或 OpenRouter API 错误

**解决**: 查看后端错误日志

### 问题 3: 前端收不到响应
**原因**: 事件名称不匹配或监听器注册时机问题

**解决**: 
- 已修复时序问题（先注册监听器，再发送事件）
- 检查事件名称：`translate_message` 和 `translate_message_response`

## 预期完整日志

### 前端
```
[MessageTranslateModal] ========== START TRANSLATION ==========
[MessageTranslateModal] ❌ No cache found, requesting from backend...
[WebSocketContext] translate_message_response listener registered
[WebSocketContext] translate_message event emitted
[MessageTranslateModal] WebSocket listener registered
[MessageTranslateModal] 📨 Received translation response: {type: 'start'}
[MessageTranslateModal] 📨 Received translation response: {type: 'chunk', content: '你好'}
[MessageTranslateModal] 📨 Received translation response: {type: 'done', translation: '你好，世界'}
[MessageTranslateModal] ✅ Translation completed: 你好，世界
```

### 后端
```
[WebSocket] ========== TRANSLATE MESSAGE REQUEST ==========
[WebSocket] Received translate_message from user123: {...}
[WebSocket] Fetching message to translate...
[WebSocket] Message found: Hello world
[WebSocket] Fetching context messages...
[WebSocket] Context messages: {before: 5, after: 2}
[WebSocket] Calling openRouterService.streamTranslate...
[WebSocket] Translation stream started
[WebSocket] Translation chunk: 你
[WebSocket] Translation chunk: 好
[WebSocket] Translation completed: 你好，世界
[WebSocket] streamTranslate completed
```
