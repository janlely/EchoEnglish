# OpenRouter 配置指南

## API 密钥配置

要使用 AI 翻译助手功能，您需要配置 OpenRouter API 密钥。

### 1. 获取 API 密钥

1. 访问 [OpenRouter](https://openrouter.ai/)
2. 注册账户并登录
3. 前往 "API Keys" 页面
4. 创建新的 API 密钥

### 2. 配置环境变量

在项目根目录（`/Users/jinjunjie/github/EchoEnglish/server/`）创建 `.env` 文件：

```bash
# OpenRouter API 配置
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openai/gpt-4o-mini  # 或其他支持的模型
```

或者，在现有的 `.env` 文件中添加这些变量。

### 3. 配置选项说明

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `OPENROUTER_API_KEY` | `''` | OpenRouter API 密钥，必填 |
| `OPENROUTER_BASE_URL` | `'https://openrouter.ai/api/v1'` | API 基础 URL |
| `OPENROUTER_MODEL` | `'openai/gpt-4o-mini'` | 使用的模型 |

### 4. 支持的模型

您可以在 [OpenRouter 模型页面](https://openrouter.ai/models) 查看支持的模型列表，例如：

- `openai/gpt-4o-mini` - 高性能模型
- `openai/gpt-3.5-turbo` - 经济高效模型
- `anthropic/claude-3-haiku` - Anthropic 的快速模型

## SDK vs 直接 API 调用

### 当前实现（推荐）：直接 API 调用
我们当前使用 `node-fetch` 直接调用 OpenRouter API，这种方式具有以下优点：

**优点：**
- 实现稳定可靠，经过充分测试
- 对 API 响应格式有完全控制
- 错误处理更加直接明确
- 与现有 SSE（Server-Sent Events）架构完美配合

**缺点：**
- 需要手动处理请求格式和认证
- 不具备 SDK 的高级功能

### 可选实现：使用官方 SDK
我们已安装 `@openrouter/sdk`，未来可切换至此实现。使用 SDK 的优点：

**优点：**
- 类型安全，减少运行时错误
- 自动处理认证和请求格式
- 可能包含更多高级功能
- 官方维护，API 变更时更容易适配

**缺点：**
- 当前 SDK 版本可能存在接口复杂性问题
- 需要额外适配 SSE 流式响应处理

### 如何切换到 SDK 实现
如果您希望使用官方 SDK，只需替换 `server/src/services/openrouter.service.ts` 中的相关代码：

```typescript
// 使用 SDK 的简化示例
import { OpenRouter } from '@openrouter/sdk';

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const stream = await openrouter.chat.send({
  model: 'anthropic/claude-sonnet-4',
  messages: [{ role: 'user', content: 'Hello' }],
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices?.[0]?.delta?.content;
  if (delta) {
    process.stdout.write(delta);
  }
}
```

## AI 助手功能更新

### 上下文消息获取
在最新的更新中，我们改进了 AI 助手的上下文获取机制：

**以前的方式：**
- 前端收集最近的聊天记录并发送给后端
- 增加了网络传输的数据量
- 前后端数据一致性可能存在问题

**现在的方式（推荐）：**
- 前端仅发送用户输入和会话ID
- 后端根据会话ID自动查询最近的20条消息作为上下文
- 更安全、更高效，减少不必要的数据传输

**API 调用变化：**
- 前端不再需要传递 `contextMessages` 参数
- 后端自动获取最近的对话历史（默认20条，可在 `getRecentMessagesForContext` 方法中调整）
- 提高了系统的整体性能和安全性

## 测试配置

### 运行测试

```bash
cd server
yarn test tests/services/openrouter-config.test.ts
```

### 手动测试

启动服务器后，在聊天界面中长按发送按钮即可测试 AI 翻译助手功能。

## 注意事项

1. **费用**：使用 OpenRouter API 会产生费用，请监控您的用量
2. **密钥安全**：不要将 API 密钥提交到版本控制系统
3. **错误处理**：如果没有配置 API 密钥，AI 功能将不可用
4. **网络要求**：确保服务器能够访问 OpenRouter API

## 故障排除

### API 密钥无效
- 检查密钥是否正确复制
- 确认密钥没有过期
- 验证环境变量名称拼写正确

### 连接超时
- 检查网络连接
- 确认防火墙设置允许访问 OpenRouter API

### 模型不可用
- 检查模型名称是否正确
- 确认您的账户有权访问该模型