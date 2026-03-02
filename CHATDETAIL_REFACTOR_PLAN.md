# ChatDetailScreen 重构方案

## 当前问题
- 文件过大（1400+ 行）
- 职责过多（消息渲染、消息发送、消息翻译、群成员管理等）
- 难以维护和测试

## 拆分方案

### 1. 提取消息组件

#### `MessageBubble.tsx` - 消息气泡组件
```typescript
// 负责渲染单个消息气泡
// Props: message, isMe, onLongPress
```

#### `MessageList.tsx` - 消息列表组件
```typescript
// 封装 FlatList，处理消息列表渲染
// Props: messages, onMessageLongPress, onLoadMore
```

#### `MessageInput.tsx` - 消息输入框组件
```typescript
// 输入框 + 发送按钮 + 长按翻译
// Props: value, onChangeText, onSend, onLongPress
```

### 2. 提取业务逻辑 Hooks

#### `useChatMessages.ts` - 消息管理 Hook
```typescript
// 消息加载、同步、确认已读
// Returns: messages, loading, hasMore, syncMessages, ackMessages
```

#### `useChatWebSocket.ts` - WebSocket 通信 Hook
```typescript
// WebSocket 连接、消息发送、事件监听
// Returns: sendMessage, joinChat, leaveChat
```

#### `useChatAvatars.ts` - 头像管理 Hook
```typescript
// 群成员头像获取和缓存
// Returns: getAvatar, syncAvatars
```

### 3. 提取翻译功能

#### `MessageTranslateModal.tsx` ✅ (已创建)
- 翻译模态框组件

#### `MessageActionMenu.tsx` ✅ (已创建)
- 长按菜单组件

#### `useMessageTranslate.ts` - 翻译 Hook
```typescript
// 翻译逻辑封装
// Returns: translateMessage, isTranslating, translation
```

### 4. 目录结构

```
src/screens/ChatDetailScreen/
├── index.tsx                    # 主组件（协调各子组件）
├── components/
│   ├── MessageBubble.tsx        # 消息气泡
│   ├── MessageList.tsx          # 消息列表
│   ├── MessageInput.tsx         # 输入框
│   ├── MessageActionMenu.tsx    # 操作菜单（已创建）
│   └── MessageTranslateModal.tsx # 翻译模态框（已创建）
├── hooks/
│   ├── useChatMessages.ts       # 消息管理
│   ├── useChatWebSocket.ts      # WebSocket 通信
│   ├── useChatAvatars.ts        # 头像管理
│   └── useMessageTranslate.ts   # 翻译功能
└── utils/
    └── messageUtils.ts          # 工具函数
```

### 5. 主组件简化后的结构

```typescript
const ChatDetailScreen = () => {
  // Hooks
  const { messages, loading, syncMessages } = useChatMessages();
  const { sendMessage } = useChatWebSocket();
  const { getAvatar } = useChatAvatars();
  const { translateMessage } = useMessageTranslate();
  
  // State
  const [showMenu, setShowMenu] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  
  // Effects
  useEffect(() => {
    syncMessages();
  }, []);
  
  return (
    <View style={styles.container}>
      <MessageList
        messages={messages}
        getAvatar={getAvatar}
        onMessageLongPress={handleLongPress}
      />
      <MessageInput
        onSend={sendMessage}
        onLongPress={handleInputLongPress}
      />
      <MessageActionMenu
        visible={showMenu}
        onPress={handleMenuAction}
        onClose={() => setShowMenu(false)}
      />
      <MessageTranslateModal
        visible={showTranslate}
        messageId={selectedMessage?.id}
        originalText={selectedMessage?.text}
        onClose={() => setShowTranslate(false)}
      />
    </View>
  );
};
```

## 实施步骤

### Phase 1: 提取组件（优先级高）
1. ✅ MessageTranslateModal.tsx
2. ✅ MessageActionMenu.tsx
3. ⏳ MessageBubble.tsx
4. ⏳ MessageList.tsx
5. ⏳ MessageInput.tsx

### Phase 2: 提取 Hooks（优先级中）
1. ⏳ useMessageTranslate.ts
2. ⏳ useChatMessages.ts
3. ⏳ useChatWebSocket.ts
4. ⏳ useChatAvatars.ts

### Phase 3: 重组主组件（优先级低）
1. ⏳ 创建新目录结构
2. ⏳ 移动代码到新文件
3. ⏳ 更新导入路径
4. ⏳ 测试验证

## 当前可立即执行的优化

由于完整重构工作量较大，可以先进行以下简单优化：

1. **提取渲染函数为独立组件**
   - `renderMessage` → `MessageBubble` 组件

2. **提取长按处理逻辑**
   - 创建 `useMessageActions` Hook

3. **添加代码注释和分段**
   - 使用注释标记不同功能区域
   - 便于后续拆分
