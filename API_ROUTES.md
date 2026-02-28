# EchoEnglish API Routes Documentation

本文档整理了前后端交互的所有 API 接口和 WebSocket 事件。

## 基础信息

- **Base URL**: `http://localhost:3000/api` (开发环境)
- **认证方式**: Bearer Token (JWT)
- **WebSocket**: Socket.IO

---

## 认证接口 (`/api/auth`)

### POST `/register` - 用户注册
**请求**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "1", "email": "user@example.com", "name": "User Name" },
    "accessToken": "xxx",
    "refreshToken": "yyy"
  }
}
```

### POST `/login` - 用户登录
**请求**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**: 同注册

### POST `/google` - Google 登录
**请求**:
```json
{
  "id": "google_id",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://..."
}
```

### POST `/refresh` - 刷新 Token
**请求**:
```json
{
  "refreshToken": "yyy"
}
```

### GET `/me` - 获取当前用户
**Headers**: `Authorization: Bearer {accessToken}`

**响应**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "1", "email": "user@example.com", "name": "User Name" }
  }
}
```

### POST `/logout` - 用户登出
**Headers**: `Authorization: Bearer {accessToken}`

---

## 好友接口 (`/api/friends`)

### POST `/search` - 搜索用户
**请求**:
```json
{
  "email": "user@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": { "id": "1", "email": "user@example.com", "name": "User Name", "avatarUrl": "..." }
  }
}
```

### POST `/request` - 发送好友请求
**请求**:
```json
{
  "receiverId": "user_id",
  "message": "Hello!"
}
```

### GET `/requests` - 获取收到的好友请求
**响应**:
```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "req_id",
        "sender": { "id": "1", "name": "Sender", "email": "sender@example.com", "avatarUrl": "..." },
        "message": "Hello!",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

### POST `/requests/:requestId/accept` - 接受好友请求
**响应**:
```json
{
  "success": true,
  "data": { "success": true },
  "message": "Friend request accepted"
}
```

### POST `/requests/:requestId/reject` - 拒绝好友请求
**响应**: 同上

### GET `/list` - 获取好友列表
**响应**:
```json
{
  "success": true,
  "data": {
    "friends": [
      {
        "id": "1",
        "name": "Friend Name",
        "email": "friend@example.com",
        "avatarUrl": "...",
        "isOnline": true
      }
    ]
  }
}
```

---

## 联系人接口 (`/api/contacts`)

### GET `/sync?friendCursor=0&groupCursor=0` - 增量同步联系人
**参数**:
- `friendCursor`: 好友同步游标（时间戳）
- `groupCursor`: 群组同步游标（时间戳）

**响应**:
```json
{
  "success": true,
  "data": {
    "friends": {
      "added": [{ "id": "1", "name": "Friend", "email": "...", "avatarUrl": "...", "isOnline": false }],
      "updated": [],
      "removed": []
    },
    "groups": {
      "added": [{ "id": "g1", "name": "Group", "avatarUrl": "...", "ownerId": "1", "memberIds": ["1", "2"] }],
      "updated": [],
      "removed": []
    },
    "newFriendCursor": 1234567890,
    "newGroupCursor": 1234567890
  }
}
```

### GET `/friends` - 获取好友列表
**响应**: 同 `/api/friends/list`

### GET `/groups` - 获取群组列表
**响应**:
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "g1",
        "name": "Group Name",
        "avatarUrl": "...",
        "ownerId": "1",
        "memberCount": 5,
        "members": [
          { "id": "1", "name": "Member", "avatarUrl": "...", "role": "owner" }
        ]
      }
    ]
  }
}
```

### POST `/groups` - 创建群组
**请求**:
```json
{
  "name": "Group Name",
  "avatarUrl": "...",
  "memberIds": ["user1", "user2"]
}
```

### POST `/groups/:groupId/members` - 添加群成员
**请求**:
```json
{
  "memberId": "user_id"
}
```

### DELETE `/groups/:groupId/members` - 移除群成员
**请求**:
```json
{
  "memberId": "user_id"
}
```

---

## 会话接口 (`/api/conversations`)

### GET `/with-unread` - 获取有未读消息的会话
**响应**:
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversationId": "user_a_user_b",
        "type": "direct",
        "targetId": "user_b",
        "name": "User B",
        "avatarUrl": "...",
        "unreadCount": 3,
        "lastReadMsgId": "msg_123"
      }
    ]
  }
}
```

### GET `/:conversationId/info` - 获取会话详情
**响应**:
```json
{
  "success": true,
  "data": {
    "conversationId": "user_a_user_b",
    "type": "direct",
    "targetId": "user_b",
    "name": "User B",
    "avatarUrl": "...",
    "unreadCount": 0,
    "lastReadMsgId": "msg_123"
  }
}
```

### POST `/:conversationId/read` - 更新会话读状态
**请求**:
```json
{
  "lastReadMsgId": "msg_123"
}
```

---

## 聊天接口 (`/api/chats`)

### GET `/sessions/sync` - 同步会话列表
**响应**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "conversationId": "user_a_user_b",
        "chatType": "direct",
        "name": "User B",
        "avatarUrl": "...",
        "unreadCount": 3,
        "lastMessage": {
          "msgId": "msg_123",
          "text": "Hello",
          "senderId": "user_b",
          "timestamp": 1234567890
        }
      }
    ]
  }
}
```

### GET `/messages/sync?conversationId=xxx&chatType=direct` - 同步消息
**参数**:
- `conversationId`: 会话 ID
- `chatType`: `direct` | `group`

**响应**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "msgId": "msg_123",
        "text": "Hello",
        "senderId": "user_b",
        "status": "sent",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "minMsgId": "msg_100"
  }
}
```

### POST `/messages/ack` - 确认消息已读
**请求**:
```json
{
  "conversationId": "user_a_user_b",
  "minMsgId": "msg_123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "count": 10
  }
}
```

### GET `/conversations/with-unread` - 获取未读会话
**响应**: 同 `/api/conversations/with-unread`

### GET `/conversations/direct/:otherUserId` - 获取或创建单聊会话
**响应**:
```json
{
  "success": true,
  "data": {
    "conversation": {
      "conversationId": "user_a_user_b",
      "type": "direct",
      "targetId": "user_b",
      "name": "User B",
      "avatarUrl": "..."
    }
  }
}
```

---

## 通知接口 (`/api/notifications`)

### GET `/` - 获取通知列表
**响应**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_id",
        "type": "message",
        "title": "New message",
        "message": "User A: Hello",
        "data": "{\"chatSessionId\":\"xxx\"}",
        "isRead": false,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

### GET `/unread-count` - 获取未读通知数
**响应**:
```json
{
  "success": true,
  "data": {
    "count": 5
  }
}
```

### PUT `/:notificationId/read` - 标记通知已读
**响应**:
```json
{
  "success": true,
  "data": { "success": true }
}
```

### PUT `/read-all` - 标记所有通知已读
**响应**: 同上

### DELETE `/:notificationId` - 删除通知
**响应**: 同上

---

## WebSocket 事件

### 客户端 → 服务器

#### `send_message` - 发送消息
**数据**:
```typescript
{
  targetId: string;      // 会话 ID
  text: string;
  type?: 'text' | 'image' | 'file';
  msgId?: string;        // 前端生成的消息 ID（用于去重）
  chatType?: 'direct' | 'group';
}
```

#### `mark_read` - 标记已读
**数据**:
```typescript
{
  chatSessionId: string;
}
```

#### `typing_start` - 开始输入
**数据**:
```typescript
{
  chatSessionId: string;
}
```

#### `typing_stop` - 停止输入
**数据**:
```typescript
{
  chatSessionId: string;
}
```

#### `join_chat` - 加入聊天室
**数据**: `chatSessionId: string`

#### `leave_chat` - 离开聊天室
**数据**: `chatSessionId: string`

### 服务器 → 客户端

#### `receive_message` - 接收消息
**数据**:
```typescript
{
  msgId: string;
  text: string;
  senderId: string;
  conversationId: string;
  status: 'sent';
  createdAt: string;
}
```

#### `message_sent` - 消息发送确认
**数据**:
```typescript
{
  msgId: string;
  messageId: string;
  status: 'sent';
}
```

#### `messages_read` - 已读广播
**数据**:
```typescript
{
  chatSessionId: string;
  userId: string;
}
```

#### `user_typing` - 用户输入中
**数据**:
```typescript
{
  chatSessionId: string;
  userId: string;
}
```

#### `user_stopped_typing` - 用户停止输入
**数据**:
```typescript
{
  chatSessionId: string;
  userId: string;
}
```

#### `user_status_changed` - 用户状态变更
**数据**:
```typescript
{
  userId: string;
  isOnline: boolean;
}
```

#### `new_notification` - 新通知
**数据**:
```typescript
{
  type: 'message' | 'friend_request' | 'system';
  title: string;
  message: string;
  data: object;
}
```

#### `error` - 错误
**数据**:
```typescript
{
  message: string;
}
```

---

## 错误响应格式

所有接口错误统一返回格式：

```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP 状态码：
- `200` - 成功
- `400` - 请求参数错误
- `401` - 未认证/Token 过期
- `403` - 无权限
- `404` - 资源不存在
- `500` - 服务器错误
