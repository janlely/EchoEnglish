# 翻译功能调试指南

## 已添加的日志

### 前端日志

#### 1. MessageTranslateModal 组件
```
========== START TRANSLATION ==========
Message ID: xxx
Conversation ID: xxx
Request ID: xxx
Checking local database for cached translation...
✅ Found cached translation in database: ... (如果有缓存)
❌ No cache found, requesting from backend...
Calling translateMessage WebSocket event...
WebSocket listener registered
📨 Received translation response: {...}
Translation started
Received chunk: ...
✅ Translation completed: ...
❌ Translation error: ...
```

#### 2. WebSocketContext
```
[WebSocketContext] translateMessage called: {...}
[WebSocketContext] translate_message event emitted
[WebSocketContext] translate_message_response listener registered
```

### 后端日志

#### WebSocket 服务
```
[WebSocket] ========== TRANSLATE MESSAGE REQUEST ==========
[WebSocket] Received translate_message from userId: {...}
[WebSocket] Fetching message to translate...
[WebSocket] Message found: ...
[WebSocket] Fetching context messages...
[WebSocket] Context messages: {before: 5, after: 2}
[WebSocket] Calling openRouterService.streamTranslate...
[WebSocket] Translation stream started
[WebSocket] Translation chunk: ...
[WebSocket] Translation completed: ...
[WebSocket] streamTranslate completed
```

## 调试步骤

### 1. 长按消息翻译

打开应用，查看日志输出：

```bash
# 前端日志
adb logcat | grep -E "MessageTranslateModal|WebSocketContext"

# 后端日志
# 查看服务器控制台输出
```

### 2. 检查日志流程

**正常流程**：
1. ✅ `START TRANSLATION`
2. ✅ `Checking local database...`
3. ✅ `No cache found, requesting from backend...`
4. ✅ `translateMessage called`
5. ✅ `translate_message event emitted`
6. ✅ `[WebSocket] Received translate_message`
7. ✅ `[WebSocket] Message found`
8. ✅ `[WebSocket] Calling openRouterService.streamTranslate...`
9. ✅ `Translation stream started`
10. ✅ `Received chunk: ...`
11. ✅ `Translation completed`

### 3. 常见问题定位

#### 问题 1: 一直 loading
**检查点**：
- 是否收到 `[WebSocket] Received translate_message` 日志？
  - ❌ 没有 → WebSocket 事件未发送到后端
  - ✅ 有 → 继续检查下一步

- 是否收到 `[WebSocket] Message found` 日志？
  - ❌ 没有 → 数据库查询失败
  - ✅ 有 → 继续检查下一步

- 是否收到 `[WebSocket] Calling openRouterService.streamTranslate...` 日志？
  - ❌ 没有 → OpenRouter 服务调用失败
  - ✅ 有 → 继续检查下一步

- 是否收到 `Translation stream started` 日志？
  - ❌ 没有 → OpenRouter API 调用失败
  - ✅ 有 → 继续检查下一步

#### 问题 2: 前端收不到响应
**检查点**：
- 后端是否发送了响应？查看 `[WebSocket] Translation stream started` 日志
- 前端是否注册了监听器？查看 `translate_message_response listener registered` 日志
- 是否收到任何 `📨 Received translation response` 日志？

#### 问题 3: 翻译成功但显示错误
**检查点**：
- 查看 `📨 Received translation response` 的 type 字段
- 检查 response 数据结构是否正确

## 预期日志示例

### 成功翻译
```
[Frontend] MessageTranslateModal: ========== START TRANSLATION ==========
[Frontend] MessageTranslateModal: ❌ No cache found, requesting from backend...
[Frontend] WebSocketContext: translateMessage called: {...}
[Frontend] WebSocketContext: translate_message event emitted
[Backend] [WebSocket] Received translate_message from user123
[Backend] [WebSocket] Message found: 你好
[Backend] [WebSocket] Calling openRouterService.streamTranslate...
[Backend] [WebSocket] Translation stream started
[Frontend] MessageTranslateModal: 📨 Received translation response: {type: 'start'}
[Backend] [WebSocket] Translation chunk: Hello
[Frontend] MessageTranslateModal: 📨 Received translation response: {type: 'chunk', content: 'Hello'}
[Backend] [WebSocket] Translation completed: Hello
[Frontend] MessageTranslateModal: 📨 Received translation response: {type: 'done', translation: 'Hello'}
[Frontend] MessageTranslateModal: ✅ Translation completed: Hello
```

### 错误情况
```
[Frontend] MessageTranslateModal: ❌ Translation error: Message not found
```

## 快速测试

1. **清除缓存测试**：
   - 翻译一条消息
   - 再次翻译同一消息（应显示缓存）
   - 查看日志中是否显示 `✅ Found cached translation`

2. **WebSocket 连接测试**：
   ```bash
   # 检查 WebSocket 是否连接
   adb logcat | grep "WebSocket"
   ```

3. **数据库查询测试**：
   - 查看 `Checking local database...` 日志
   - 如果有缓存，应显示 `✅ Found cached translation`
