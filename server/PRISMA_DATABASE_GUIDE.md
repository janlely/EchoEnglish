# Prisma 数据库切换指南

## 支持的数据库

Prisma 支持以下数据库：
- ✅ **SQLite** - 轻量级，适合开发和测试
- ✅ **PostgreSQL** - 生产环境推荐
- ✅ **MySQL** 
- ✅ **MariaDB**
- ✅ **SQL Server**
- ✅ **MongoDB** (预览版)

## 为什么开发用 SQLite，生产用 PostgreSQL？

### SQLite 优势（开发环境）
- 🚀 零配置，开箱即用
- 📁 单文件数据库，便于分享和备份
- 💾 无需安装数据库服务器
- ⚡ 启动速度快
- 🧪 适合单元测试

### PostgreSQL 优势（生产环境）
- 🔒 企业级安全性和稳定性
- 📊 支持高并发和大数据量
- 🔄 支持事务和复杂查询
- 🔧 丰富的扩展功能
- 📈 更好的性能优化

## 切换步骤

### 1. 修改 Prisma Schema

在 `prisma/schema.prisma` 中：

```prisma
// 开发环境 - SQLite
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// 生产环境 - PostgreSQL
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. 配置环境变量

#### 开发环境 (.env)
```env
DATABASE_URL="file:./dev.db"
```

#### 生产环境 (.env.production)
```env
DATABASE_URL="postgresql://user:password@localhost:5432/echoenglish?schema=public"
```

### 3. 注意事项

#### 数据类型差异
某些数据类型在不同数据库中可能不同：

```prisma
// ✅ 通用类型
model User {
  id        String   @id @default(uuid())  // PostgreSQL/SQLite 都支持
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  isOnline  Boolean  @default(false)
}

// ⚠️ 需要注意的类型
model Message {
  id        String   @id @default(uuid())
  content   String   @db.Text  // SQLite 不需要 @db.Text
  metadata  Json?             // SQLite 需要特殊处理
}
```

#### UUID 生成
SQLite 不原生支持 UUID，需要使用不同的默认值：

**PostgreSQL:**
```prisma
id String @id @default(uuid())
```

**SQLite:**
```prisma
id String @id @default(cuid())  // 或使用 autoincrement
```

#### 推荐方案：使用 CUID
为了兼容性，建议统一使用 `cuid()`：

```prisma
model User {
  id String @id @default(cuid())
  // ...
}
```

## 完整配置示例

### 方案 A：使用不同 Schema 文件

#### prisma/schema.postgresql.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  // ...
}
```

#### prisma/schema.sqlite.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  // ...
}
```

#### package.json 脚本
```json
{
  "scripts": {
    "dev": "DATABASE_URL=\"file:./dev.db\" prisma migrate dev",
    "prod": "prisma migrate deploy"
  }
}
```

### 方案 B：使用条件环境变量（推荐）

#### .env.development
```env
DATABASE_URL="file:./dev.db"
```

#### .env.production
```env
DATABASE_URL="postgresql://user:password@localhost:5432/echoenglish"
```

#### prisma/schema.prisma
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"  // 默认 SQLite
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // 关系字段
  messages      Message[]
  chatSessions  ChatParticipant[]
}

// ... 其他模型
```

## 迁移流程

### 开发环境（SQLite）

```bash
# 1. 设置开发环境变量
export DATABASE_URL="file:./dev.db"

# 2. 生成迁移
npx prisma migrate dev --name init

# 3. 生成 Prisma Client
npx prisma generate

# 4. 启动开发服务器
npm run dev
```

### 生产环境（PostgreSQL）

```bash
# 1. 设置生产环境变量
export DATABASE_URL="postgresql://..."

# 2. 修改 schema 中的 provider（或使用条件 schema）

# 3. 生成迁移
npx prisma migrate deploy

# 4. 生成 Prisma Client
npx prisma generate

# 5. 启动生产服务器
npm start
```

## 自动化脚本

### scripts/setup-database.sh

```bash
#!/bin/bash

if [ "$NODE_ENV" = "production" ]; then
  echo "Setting up PostgreSQL..."
  export DATABASE_URL="postgresql://..."
  npx prisma migrate deploy
  npx prisma generate
else
  echo "Setting up SQLite..."
  export DATABASE_URL="file:./dev.db"
  npx prisma migrate dev
  npx prisma generate
fi
```

## 测试策略

### 单元测试使用 SQLite

```typescript
// tests/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./test.db',
    },
  },
});

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  // 清理数据库
  await prisma.$executeRawUnsafe('DELETE FROM "Message"');
  await prisma.$executeRawUnsafe('DELETE FROM "User"');
  // ...
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

## 常见问题

### Q1: 迁移文件能通用吗？
**A:** 是的，Prisma 迁移文件是数据库无关的，可以在不同数据库间使用。

### Q2: 需要为不同数据库维护不同 schema 吗？
**A:** 不需要。Prisma 会自动处理大部分差异。只需注意：
- 使用 `cuid()` 代替 `uuid()` 以获得更好的兼容性
- 避免使用数据库特定的类型修饰符

### Q3: 如何在现有项目中切换数据库？
**A:** 
1. 修改 `schema.prisma` 中的 `provider`
2. 更新 `DATABASE_URL` 环境变量
3. 运行 `prisma migrate resolve` 处理迁移
4. 运行 `prisma generate` 重新生成客户端

### Q4: SQLite 支持所有 PostgreSQL 功能吗？
**A:** 不支持。主要差异：
- ❌ 没有原生 UUID 支持
- ❌ 没有完整的 JSON 支持
- ❌ 没有某些高级查询功能
- ✅ 但基本 CRUD、关系、事务都支持

## 推荐配置

对于 EchoEnglish 项目，推荐配置：

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"  // 开发用 SQLite
  url      = env("DATABASE_URL")
}

// 使用 cuid 保证兼容性
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  // ...
}
```

```bash
# 开发
DATABASE_URL="file:./dev.db" npm run dev

# 生产
DATABASE_URL="postgresql://..." npm start
```

## 总结

✅ **可以切换**：Prisma 支持在 SQLite 和 PostgreSQL 之间切换
✅ **推荐做法**：开发用 SQLite，生产用 PostgreSQL
✅ **注意事项**：
- 使用 `cuid()` 代替 `uuid()`
- 避免数据库特定的类型
- 测试时注意功能差异

这样可以：
- 🚀 加快开发速度
- 💰 降低开发成本
- 🔧 简化测试流程
- 📊 保证生产性能
