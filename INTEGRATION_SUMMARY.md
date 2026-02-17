# EchoEnglish 前后端集成实现总结

## 实现完成的功能

### 1. 数据库层
- ✅ 创建 `AuthToken` 模型存储 JWT Token
- ✅ 更新数据库 schema 到 version 2
- ✅ 添加 `password_hash` 和 `google_id` 字段到 User 模型

### 2. 服务层

#### ApiService (src/services/ApiService.ts)
- ✅ 基于 fetch 的 HTTP 客户端
- ✅ 自动 Token 管理（存储到 WatermelonDB）
- ✅ Token 自动刷新机制
- ✅ 401 错误自动重试
- ✅ 认证 API：login, register, logout, getCurrentUser
- ✅ 聊天 API：getChats, getMessages, sendMessage, markMessagesRead

#### WebSocketService (src/services/WebSocketService.ts)
- ✅ 基于 socket.io-client 的 WebSocket 客户端
- ✅ 自动连接和重连
- ✅ 事件订阅和取消订阅
- ✅ 消息发送：sendMessage
- ✅ 聊天室管理：joinChat, leaveChat
- ✅ 消息状态：markRead
- ✅ 输入状态：startTyping, stopTyping

### 3. Context 层

#### AuthContext (src/contexts/AuthContext.tsx)
- ✅ 使用后端 API 进行认证
- ✅ 自动登录功能
- ✅ 用户数据同步到本地数据库
- ✅ Token 自动管理（通过 ApiService）

#### WebSocketContext (src/contexts/WebSocketContext.tsx)
- ✅ WebSocket 连接管理
- ✅ 提供 WebSocket 方法给子组件
- ✅ 自动连接和断开

### 4. UI 层

#### LoginScreen
- ✅ 调用后端 API 登录
- ✅ 自动保存 Token

#### RegisterScreen
- ✅ 调用后端 API 注册
- ✅ 参数顺序调整

#### ChatDetailScreen
- ✅ 使用 WebSocket 发送消息
- ✅ 监听新消息并保存到本地数据库
- ✅ 加入/离开聊天室
- ✅ 消息自动同步

#### MainScreen
- ✅ 通过 WatermelonDB observe 自动更新消息列表
- ✅ 无需额外修改，自动响应本地数据库变化

### 5. App 配置
- ✅ 添加 WebSocketProvider 到 App.tsx
- ✅ Provider 层级：DatabaseProvider > AuthProvider > WebSocketProvider

## 数据流程

### 登录流程
```
用户输入 → LoginScreen
    ↓
AuthContext.login()
    ↓
ApiService.login() → POST /api/auth/login
    ↓
后端返回 { user, accessToken, refreshToken }
    ↓
ApiService 保存 Token 到 WatermelonDB (auth_tokens 表)
    ↓
AuthContext 设置 user 状态
    ↓
同步用户数据到本地数据库
    ↓
导航到主页面
```

### 消息发送流程
```
用户输入 → ChatDetailScreen.handleSendMessage()
    ↓
WebSocketService.sendMessage()
    ↓
emit 'send_message' 到后端
    ↓
后端保存消息并广播给其他用户
    ↓
接收者 WebSocket 收到 'receive_message' 事件
    ↓
ChatDetailScreen.saveMessageToLocal()
    ↓
保存到 WatermelonDB (messages 表)
    ↓
WatermelonDB observe 触发 UI 更新
```

### 消息接收流程
```
WebSocket 'receive_message' 事件
    ↓
ChatDetailScreen.onMessage() 监听
    ↓
saveMessageToLocal() 保存消息
    ↓
检查消息是否已存在（避免重复）
    ↓
保存到 WatermelonDB
    ↓
FlatList 自动更新显示新消息
```

### Token 刷新流程
```
API 请求返回 401
    ↓
ApiService 拦截器捕获
    ↓
isRefreshing = true
    ↓
使用 refresh token 调用 /api/auth/refresh
    ↓
获取新 token 对
    ↓
保存到 WatermelonDB
    ↓
通知等待的请求（refreshSubscribers）
    ↓
重试原请求
    ↓
刷新失败 → 清除 Token → 跳转登录
```

## 文件清单

### 新增文件
- `src/database/models/AuthToken.ts`
- `src/config/constants.ts`
- `src/services/ApiService.ts`
- `src/services/WebSocketService.ts`
- `src/contexts/WebSocketContext.tsx`

### 修改文件
- `src/database/schema.ts` (version 2, 添加 auth_tokens 表)
- `src/database/models/index.ts` (导出 AuthToken)
- `src/contexts/AuthContext.tsx` (使用后端 API)
- `src/screens/RegisterScreen.tsx` (参数顺序)
- `src/screens/ChatDetailScreen.tsx` (WebSocket 集成)
- `src/screens/LoginScreen.tsx` (移除未使用的 loginWithGoogle)
- `App.tsx` (添加 WebSocketProvider)

## 依赖说明

### 已使用依赖
- WatermelonDB - 本地数据库（已有）
- socket.io-client - WebSocket 客户端（需手动安装）
- React Native 原生 fetch - HTTP 请求（已有）

### 无需额外依赖
- ✅ 使用 WatermelonDB 存储 Token（不需要 AsyncStorage）
- ✅ 使用原生 fetch（不需要 axios）

## 安装步骤

1. 安装 socket.io-client：
```bash
npm install socket.io-client
```

2. 运行应用：
```bash
npm start
```

## 配置说明

### API 配置 (src/config/constants.ts)
```typescript
export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://10.0.2.2:3000'  // Android 模拟器
    : 'http://localhost:3000', // iOS 模拟器
  TIMEOUT: 10000,
};
```

根据实际后端地址修改。

## 测试清单

- [ ] 用户注册
- [ ] 用户登录
- [ ] 自动登录（重启应用）
- [ ] Token 刷新
- [ ] 发送消息
- [ ] 接收消息
- [ ] 消息保存到本地
- [ ] WebSocket 重连
- [ ] 登出

## 注意事项

1. **后端地址配置**：根据实际部署地址修改 `API_CONFIG.BASE_URL` 和 `WS_CONFIG.URL`

2. **数据库迁移**：schema version 已更新到 2，需要运行数据库迁移

3. **WebSocket 连接**：应用启动时自动尝试连接 WebSocket

4. **离线支持**：消息保存在本地 WatermelonDB，支持离线查看

5. **Token 安全**：Token 存储在 WatermelonDB 中，生产环境可考虑加密

## 后续优化

1. 添加加载状态和错误提示
2. 添加网络状态检测
3. 添加消息发送失败重试
4. 添加离线消息同步
5. 添加推送通知支持
6. Token 加密存储
