# EchoEnglish Server

EchoEnglish 英语聊天应用的后端服务，使用 TypeScript、Express、Prisma 和 Socket.IO 构建。

## 功能特性

- ✅ 用户认证（邮箱密码、Google OAuth）
- ✅ JWT Token 管理（Access + Refresh）
- ✅ 实时消息推送（WebSocket）
- ✅ 聊天会话管理
- ✅ 消息 CRUD 操作
- ✅ 通知系统
- ✅ 在线状态追踪
- ✅ Typing 指示器
- ✅ 消息已读状态

## 技术栈

- **运行时**: Node.js 20+
- **语言**: TypeScript 5+
- **框架**: Express 4.x
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **实时通信**: Socket.IO
- **认证**: JWT
- **验证**: Zod
- **日志**: Winston

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

**数据库配置：**
- **开发环境**：默认使用 SQLite（无需安装数据库服务器）
- **生产环境**：使用 PostgreSQL

```env
# 开发环境（SQLite - 单文件数据库）
DATABASE_URL="file:./dev.db"

# 生产环境（PostgreSQL）
# DATABASE_URL="postgresql://username:password@localhost:5432/echoenglish?schema=public"
```

### 3. 设置数据库

```bash
# 初始化数据库（开发环境使用 SQLite）
npm run setup:dev

# 或者分步执行：
npm run db:generate    # 生成 Prisma 客户端
npm run db:dev         # 运行数据库迁移
npm run db:seed        # 播种测试数据
```

### 4. 启动服务器

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

## API 文档

### 认证接口

#### 用户注册
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

#### 用户登录
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Google 登录
```
POST /api/auth/google
Content-Type: application/json

{
  "id": "google-user-id",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://..."
}
```

#### 刷新 Token
```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

#### 获取当前用户
```
GET /api/auth/me
Authorization: Bearer <access_token>
```

#### 登出
```
POST /api/auth/logout
Authorization: Bearer <access_token>
```

### 聊天接口

#### 创建聊天会话
```
POST /api/chats
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "participantIds": ["user-id-1", "user-id-2"],
  "name": "Group Chat",
  "type": "group"
}
```

#### 获取聊天列表
```
GET /api/chats?page=1&limit=20
Authorization: Bearer <access_token>
```

#### 获取聊天详情
```
GET /api/chats/:id
Authorization: Bearer <access_token>
```

#### 更新聊天
```
PUT /api/chats/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "New Chat Name",
  "avatarUrl": "https://..."
}
```

#### 删除聊天
```
DELETE /api/chats/:id
Authorization: Bearer <access_token>
```

#### 标记聊天为已读
```
POST /api/chats/:id/read
Authorization: Bearer <access_token>
```

### 消息接口

#### 发送消息
```
POST /api/chats/:chatSessionId/messages
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "text": "Hello, World!",
  "type": "text"
}
```

#### 获取消息历史
```
GET /api/chats/:chatSessionId/messages?page=1&limit=50
Authorization: Bearer <access_token>
```

#### 更新消息
```
PUT /api/chats/messages/:messageId
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "text": "Updated message"
}
```

#### 删除消息
```
DELETE /api/chats/messages/:messageId
Authorization: Bearer <access_token>
```

#### 标记消息为已读
```
POST /api/chats/:chatSessionId/messages/read
Authorization: Bearer <access_token>
```

### 通知接口

#### 获取通知列表
```
GET /api/notifications?page=1&limit=50
Authorization: Bearer <access_token>
```

#### 获取未读数量
```
GET /api/notifications/unread-count
Authorization: Bearer <access_token>
```

#### 标记通知为已读
```
PUT /api/notifications/:notificationId/read
Authorization: Bearer <access_token>
```

#### 标记所有通知为已读
```
PUT /api/notifications/read-all
Authorization: Bearer <access_token>
```

#### 删除通知
```
DELETE /api/notifications/:notificationId
Authorization: Bearer <access_token>
```

## WebSocket 事件

### 连接

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-access-token'
  }
});
```

### 客户端到服务器事件

#### 加入聊天室
```javascript
socket.emit('join_chat', { chatSessionId: 'chat-id' });
```

#### 离开聊天室
```javascript
socket.emit('leave_chat', { chatSessionId: 'chat-id' });
```

#### 发送消息
```javascript
socket.emit('send_message', {
  chatSessionId: 'chat-id',
  text: 'Hello!',
  type: 'text'
});
```

#### 标记消息已读
```javascript
socket.emit('mark_read', { chatSessionId: 'chat-id' });
```

#### 开始输入
```javascript
socket.emit('typing_start', { chatSessionId: 'chat-id' });
```

#### 停止输入
```javascript
socket.emit('typing_stop', { chatSessionId: 'chat-id' });
```

### 服务器到客户端事件

#### 接收消息
```javascript
socket.on('receive_message', (message) => {
  console.log('New message:', message);
});
```

#### 用户状态变化
```javascript
socket.on('user_status_changed', ({ userId, isOnline }) => {
  console.log(`User ${userId} is ${isOnline ? 'online' : 'offline'}`);
});
```

#### 用户正在输入
```javascript
socket.on('user_typing', ({ chatSessionId, userId }) => {
  console.log(`User ${userId} is typing`);
});
```

#### 用户停止输入
```javascript
socket.on('user_stopped_typing', ({ chatSessionId, userId }) => {
  console.log(`User ${userId} stopped typing`);
});
```

#### 消息已读
```javascript
socket.on('messages_read', ({ chatSessionId, userId }) => {
  console.log(`User ${userId} read messages`);
});
```

#### 新通知
```javascript
socket.on('new_notification', (notification) => {
  console.log('New notification:', notification);
});
```

## 项目结构

```
server/
├── src/
│   ├── config/           # 配置文件
│   ├── controllers/      # 控制器
│   ├── services/         # 业务逻辑
│   ├── middleware/       # 中间件
│   ├── routes/           # 路由
│   ├── types/            # TypeScript 类型
│   ├── utils/            # 工具函数
│   ├── app.ts            # Express 应用
│   └── server.ts         # 入口文件
├── prisma/
│   └── schema.prisma     # 数据库模型
└── tests/                # 测试文件
```

## 开发

### 代码检查

```bash
npm run lint
npm run lint:fix
npm run format
```

### 测试

```bash
npm run test
npm run test:watch
npm run test:coverage
```

## 部署

### Docker 部署（推荐）

```bash
docker build -t echoenglish-server .
docker run -p 3000:3000 --env-file .env echoenglish-server
```

### 直接部署

```bash
npm run build
NODE_ENV=production npm start
```

## 安全考虑

- 密码使用 bcrypt 加密存储
- JWT Token 设置合理过期时间
- 请求速率限制
- 输入验证（Zod）
- CORS 配置
- Helmet 安全头
- SQL 注入防护（Prisma）

## 许可证

MIT
