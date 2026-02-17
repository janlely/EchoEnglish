# EchoEnglish Backend 实现计划

## 项目概述
为 EchoEnglish 英语聊天应用构建一个完整的 TypeScript 后端服务，支持用户认证、实时消息、通知等功能。

## 技术栈
- **运行时**: Node.js 20+
- **语言**: TypeScript 5+
- **Web 框架**: Express 4.x
- **数据库**: PostgreSQL + Prisma ORM
- **实时通信**: Socket.IO
- **认证**: JWT (JSON Web Tokens)
- **缓存**: Redis (可选)
- **消息队列**: Bull (用于通知队列)

## 功能模块

### 1. 用户认证模块
- 用户注册（邮箱 + 密码）
- 用户登录（邮箱密码、Google OAuth）
- JWT Token 管理（access token + refresh token）
- 密码加密（bcrypt）
- 邮箱验证
- 密码重置

### 2. 用户管理模块
- 用户信息 CRUD
- 头像上传
- 个人资料更新
- 在线状态管理

### 3. 聊天会话模块
- 创建聊天会话
- 获取会话列表
- 会话成员管理
- 未读消息计数
- 会话置顶/取消置顶

### 4. 消息模块
- 发送消息（文本、图片）
- 消息状态（已发送、已送达、已读）
- 消息历史记录
- 消息撤回
- 消息删除

### 5. 实时通信模块
- WebSocket 连接管理
- 实时消息推送
- 在线状态推送
-  typing 状态推送
- 连接心跳检测

### 6. 通知模块
- 新消息通知
- 好友请求通知
- 系统通知
- 推送通知集成（FCM/APNs）

## 项目结构

```
server/
├── src/
│   ├── config/           # 配置文件
│   │   ├── database.ts
│   │   ├── jwt.ts
│   │   └── cors.ts
│   ├── controllers/      # 控制器
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── message.controller.ts
│   │   └── notification.controller.ts
│   ├── services/         # 业务逻辑层
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── chat.service.ts
│   │   ├── message.service.ts
│   │   ├── notification.service.ts
│   │   └── websocket.service.ts
│   ├── models/           # 数据模型
│   │   └── index.ts
│   ├── middleware/       # 中间件
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── rateLimit.middleware.ts
│   ├── routes/           # 路由
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── chat.routes.ts
│   │   ├── message.routes.ts
│   │   └── notification.routes.ts
│   ├── types/            # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/            # 工具函数
│   │   ├── logger.ts
│   │   ├── validator.ts
│   │   └── helpers.ts
│   ├── websocket/        # WebSocket 处理
│   │   └── handlers.ts
│   ├── app.ts            # Express 应用
│   └── server.ts         # 入口文件
├── prisma/
│   ├── schema.prisma     # Prisma 数据库模型
│   └── migrations/       # 数据库迁移
├── tests/                # 测试文件
│   ├── unit/
│   └── integration/
├── .env.example          # 环境变量示例
├── .env                  # 环境变量（本地开发）
├── package.json
├── tsconfig.json
├── nodemon.json
└── README.md
```

## API 设计

### 认证相关
```
POST   /api/auth/register      # 用户注册
POST   /api/auth/login         # 用户登录
POST   /api/auth/logout        # 用户登出
POST   /api/auth/refresh       # 刷新 Token
POST   /api/auth/google        # Google 登录
POST   /api/auth/forgot-password  # 忘记密码
POST   /api/auth/reset-password   # 重置密码
```

### 用户相关
```
GET    /api/users/me           # 获取当前用户信息
PUT    /api/users/me           # 更新用户信息
POST   /api/users/avatar       # 上传头像
GET    /api/users/:id          # 获取指定用户信息
GET    /api/users              # 搜索用户
```

### 聊天会话相关
```
GET    /api/chats              # 获取聊天列表
POST   /api/chats              # 创建聊天会话
GET    /api/chats/:id          # 获取聊天详情
PUT    /api/chats/:id          # 更新聊天设置
DELETE /api/chats/:id          # 删除聊天会话
POST   /api/chats/:id/read     # 标记为已读
```

### 消息相关
```
GET    /api/chats/:id/messages     # 获取消息历史
POST   /api/chats/:id/messages     # 发送消息
PUT    /api/messages/:id           # 更新消息
DELETE /api/messages/:id           # 删除消息
POST   /api/messages/:id/read      # 标记消息已读
```

### 通知相关
```
GET    /api/notifications          # 获取通知列表
PUT    /api/notifications/:id/read # 标记通知已读
DELETE /api/notifications/:id      # 删除通知
```

### WebSocket 事件
```
连接：connect, disconnect
消息：send_message, receive_message, message_status
状态：user_online, user_offline, typing_start, typing_stop
通知：new_notification
```

## 数据库设计

### User 表
```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String
  passwordHash  String?
  googleId      String?   @unique
  avatarUrl     String?
  isOnline      Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastSeenAt    DateTime?
  
  messages      Message[]
  sessions      ChatParticipant[]
  settings      UserSetting?
}
```

### ChatSession 表
```prisma
model ChatSession {
  id          String   @id @default(uuid())
  name        String?
  type        String   @default("direct") // direct, group
  avatarUrl   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  participants ChatParticipant[]
  messages     Message[]
}
```

### Message 表
```prisma
model Message {
  id            String   @id @default(uuid())
  text          String
  type          String   @default("text") // text, image
  status        String   @default("sent") // sent, delivered, read
  senderId      String
  chatSessionId String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  sender        User     @relation(fields: [senderId], references: [id])
  chatSession   ChatSession @relation(fields: [chatSessionId], references: [id])
}
```

## 实现步骤

### 第一阶段：基础设置（Step 1）
1. 创建项目结构和配置文件
2. 安装依赖
3. 配置 TypeScript
4. 配置 ESLint + Prettier
5. 设置数据库连接

### 第二阶段：认证系统（Step 2-4）
1. 实现 JWT 认证中间件
2. 实现用户注册 API
3. 实现用户登录 API
4. 实现 Token 刷新机制
5. 实现 Google OAuth 集成

### 第三阶段：聊天功能（Step 5-6）
1. 实现聊天会话 CRUD
2. 实现消息 CRUD
3. 实现 WebSocket 实时通信
4. 实现消息推送

### 第四阶段：通知系统（Step 7）
1. 实现通知服务
2. 实现推送通知集成
3. 实现通知队列

### 第五阶段：完善与测试（Step 8）
1. 编写 API 文档
2. 编写单元测试
3. 编写集成测试
4. 性能优化

## 安全考虑
- 密码使用 bcrypt 加密
- JWT Token 设置合理过期时间
- 实现请求速率限制
- 输入验证和 sanitization
- CORS 配置
- Helmet 安全头
- SQL 注入防护（Prisma 已内置）

## 性能优化
- 数据库索引优化
- Redis 缓存常用数据
- 消息分页加载
- WebSocket 连接池管理
- 静态资源 CDN

## 监控与日志
- Winston 日志记录
- 错误追踪（Sentry）
- 性能监控
- 健康检查端点

---

现在开始分步实现...
