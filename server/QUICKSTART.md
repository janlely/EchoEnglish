# EchoEnglish Server 快速启动指南

## 前提条件

- Node.js 20+
- PostgreSQL 14+
- npm 或 yarn

## 安装步骤

### 1. 进入服务器目录

```bash
cd server
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置数据库

#### 创建 PostgreSQL 数据库

```bash
# 使用 psql 或数据库管理工具
createdb echoenglish
```

或者使用 PostgreSQL 用户和权限：

```sql
CREATE DATABASE echoenglish;
CREATE USER echoenglish WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE echoenglish TO echoenglish;
```

#### 更新 .env 文件

编辑 `server/.env` 文件，设置正确的数据库连接字符串：

```env
DATABASE_URL="postgresql://echoenglish:password@localhost:5432/echoenglish?schema=public"
```

### 4. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# (可选) 播种测试数据
npm run prisma:seed
```

### 5. 启动服务器

```bash
# 开发模式（带热重载）
npm run dev

# 或生产模式
npm run build
npm start
```

服务器应该在 http://localhost:3000 启动

## 验证安装

### 检查服务器状态

```bash
curl http://localhost:3000
```

应该返回：

```json
{
  "success": true,
  "message": "EchoEnglish API Server",
  "version": "1.0.0"
}
```

### 检查健康状态

```bash
curl http://localhost:3000/api/health
```

### 测试用户注册

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### 测试用户登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 使用测试数据

如果运行了 `npm run prisma:seed`，可以使用以下测试账号：

**账号 1:**
- 邮箱：test1@example.com
- 密码：password123

**账号 2:**
- 邮箱：test2@example.com
- 密码：password123

**账号 3:**
- 邮箱：test3@example.com
- 密码：password123

## 使用 Postman 测试

### 1. 导入 API 集合

创建 Postman 集合，添加以下请求：

#### 注册
- POST `http://localhost:3000/api/auth/register`
- Body (JSON):
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User"
}
```

#### 登录
- POST `http://localhost:3000/api/auth/login`
- Body (JSON):
```json
{
  "email": "test1@example.com",
  "password": "password123"
}
```

保存返回的 `accessToken`，在后续请求中使用。

#### 获取用户信息
- GET `http://localhost:3000/api/auth/me`
- Headers:
  - Authorization: `Bearer <your-access-token>`

#### 创建聊天
- POST `http://localhost:3000/api/chats`
- Headers:
  - Authorization: `Bearer <your-access-token>`
  - Content-Type: `application/json`
- Body (JSON):
```json
{
  "participantIds": ["<user-id-2>"],
  "type": "direct"
}
```

#### 获取聊天列表
- GET `http://localhost:3000/api/chats`
- Headers:
  - Authorization: `Bearer <your-access-token>`

#### 发送消息
- POST `http://localhost:3000/api/chats/<chat-id>/messages`
- Headers:
  - Authorization: `Bearer <your-access-token>`
  - Content-Type: `application/json`
- Body (JSON):
```json
{
  "text": "Hello, World!",
  "type": "text"
}
```

## WebSocket 测试

使用 Socket.IO 客户端测试实时消息：

```javascript
const io = require('socket.io-client');

// 先登录获取 token
const token = 'your-access-token';

const socket = io('http://localhost:3000', {
  auth: { token }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
  
  // 加入聊天室
  socket.emit('join_chat', { chatSessionId: 'chat-id' });
  
  // 发送消息
  socket.emit('send_message', {
    chatSessionId: 'chat-id',
    text: 'Hello from WebSocket!',
    type: 'text'
  });
});

socket.on('receive_message', (message) => {
  console.log('Received message:', message);
});

socket.on('user_status_changed', (data) => {
  console.log('User status changed:', data);
});
```

## 常见问题

### 1. 数据库连接失败

确保 PostgreSQL 正在运行：

```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Windows
net start postgresql
```

### 2. 端口被占用

编辑 `.env` 文件，更改端口：

```env
PORT=3001
```

### 3. Prisma 迁移错误

重置数据库并重新迁移：

```bash
npm run prisma:migrate -- --reset
```

### 4. 模块未找到错误

重新安装依赖：

```bash
rm -rf node_modules package-lock.json
npm install
npm run prisma:generate
```

## 下一步

1. 配置 Google OAuth（可选）
   - 参考 `GOOGLE_SIGNIN_SETUP.md`

2. 配置 Redis（可选，用于生产环境）
   - 更新 `.env` 中的 Redis 配置

3. 设置推送通知（可选）
   - 配置 Firebase Cloud Messaging

4. 部署到生产环境
   - 使用 Docker 或直接部署
   - 配置环境变量
   - 设置反向代理（Nginx）

## 开发工具推荐

- **数据库管理**: Prisma Studio (`npm run prisma:studio`)
- API 测试：Postman 或 Insomnia
- **WebSocket 测试**: Socket.IO 客户端工具
- **日志查看**: 查看 `logs/` 目录

## 获取帮助

如果遇到问题：

1. 检查日志文件 `logs/error.log`
2. 查看控制台输出
3. 确保所有环境变量正确配置
4. 验证数据库连接

祝使用愉快！
