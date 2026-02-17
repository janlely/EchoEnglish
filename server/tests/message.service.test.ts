import messageService from '../src/services/message.service';
import chatService from '../src/services/chat.service';
import authService from '../src/services/auth.service';

// 使用测试数据库
const TEST_DATABASE_URL = 'file:./test.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;

// 生成唯一邮箱
const generateEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

describe('Message Service', () => {
  let user1Id: string;
  let user2Id: string;
  let chatSessionId: string;

  // 在每个测试前清理数据并创建测试用户和聊天
  beforeEach(async () => {
    // 清理数据库
    const { prisma } = await import('../src/config/database');
    try {
      // 按依赖关系倒序删除
      await prisma.notification.deleteMany();
      await prisma.message.deleteMany();
      await prisma.chatParticipant.deleteMany();
      await prisma.userSetting.deleteMany();
      await prisma.chatSession.deleteMany();
      await prisma.user.deleteMany();
    } catch (error) {
      // 如果清理失败，尝试直接执行 SQL 清理
      try {
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
        await prisma.notification.deleteMany();
        await prisma.message.deleteMany();
        await prisma.chatParticipant.deleteMany();
        await prisma.userSetting.deleteMany();
        await prisma.chatSession.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
      } catch (e) {
        console.error('Cleanup failed:', e);
      }
    }

    // 创建测试用户并保存 ID
    const [user1, user2] = await Promise.all([
      authService.register(
        generateEmail('msguser1'),
        'password123',
        'Message User 1'
      ),
      authService.register(
        generateEmail('msguser2'),
        'password123',
        'Message User 2'
      )
    ]);

    user1Id = user1.id;
    user2Id = user2.id;

    // 创建聊天会话
    const session = await chatService.createChatSession(
      user1Id,
      [user2Id],
      undefined,
      'direct'
    );

    chatSessionId = session.id;
  });

  describe('sendMessage', () => {
    it('应该成功发送消息', async () => {
      const message = await messageService.sendMessage(
        chatSessionId,
        user1Id,
        'Hello, World!',
        'text'
      );

      expect(message).toBeDefined();
      expect(message.text).toBe('Hello, World!');
      expect(message.type).toBe('text');
      expect(message.status).toBe('sent');
      expect(message.senderId).toBe(user1Id);
    });

    it('应该拒绝非参与者发送消息', async () => {
      const user3 = await authService.register(
        generateEmail('msguser3'),
        'password123',
        'Message User 3'
      );

      await expect(
        messageService.sendMessage(chatSessionId, user3.id, 'Test', 'text')
      ).rejects.toThrow('Access denied');
    });

    it('应该更新聊天会话的更新时间', async () => {
      const session = await chatService.getChatSession(chatSessionId, user1Id);
      const updatedAtBefore = session.updatedAt;

      await messageService.sendMessage(
        chatSessionId,
        user1Id,
        'New message',
        'text'
      );

      const sessionAfter = await chatService.getChatSession(chatSessionId, user1Id);
      
      expect(sessionAfter.updatedAt.getTime()).toBeGreaterThanOrEqual(
        updatedAtBefore.getTime()
      );
    });
  });

  describe('getMessages', () => {
    beforeEach(async () => {
      // 串行创建测试消息，避免并发更新同一聊天会话
      await messageService.sendMessage(chatSessionId, user1Id, 'Message 1', 'text');
      await messageService.sendMessage(chatSessionId, user2Id, 'Message 2', 'text');
      await messageService.sendMessage(chatSessionId, user1Id, 'Message 3', 'text');
    });

    it('应该获取消息列表', async () => {
      // 先创建消息
      await messageService.sendMessage(chatSessionId, user1Id, 'Test Message', 'text');

      const result = await messageService.getMessages(chatSessionId, user1Id, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
    });

    it('应该支持分页', async () => {
      const result = await messageService.getMessages(chatSessionId, user1Id, {
        page: 1,
        limit: 2,
      });

      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.pagination.total).toBeGreaterThan(0);
    });

    it('应该拒绝非参与者获取消息', async () => {
      const user3 = await authService.register(
        generateEmail('msguser4'),
        'password123',
        'Message User 4'
      );

      await expect(
        messageService.getMessages(chatSessionId, user3.id)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('updateMessage', () => {
    let messageId: string;

    beforeEach(async () => {
      const message = await messageService.sendMessage(
        chatSessionId,
        user1Id,
        'Original message',
        'text'
      );
      messageId = message.id;
    });

    it('应该成功更新消息', async () => {
      const updated = await messageService.updateMessage(
        messageId,
        user1Id,
        'Updated message'
      );

      expect(updated).toBeDefined();
      expect(updated.text).toBe('Updated message');
    });

    it('应该拒绝更新他人的消息', async () => {
      await expect(
        messageService.updateMessage(messageId, user2Id, 'Hacked message')
      ).rejects.toThrow('Access denied');
    });
  });

  describe('deleteMessage', () => {
    let messageId: string;

    beforeEach(async () => {
      const message = await messageService.sendMessage(
        chatSessionId,
        user1Id,
        'Message to delete',
        'text'
      );
      messageId = message.id;
    });

    it('应该成功删除消息', async () => {
      const result = await messageService.deleteMessage(messageId, user1Id);

      expect(result.success).toBe(true);

      // 验证消息已被删除
      const messages = await messageService.getMessages(chatSessionId, user1Id);
      const deletedMessage = messages.data.find(m => m.id === messageId);
      expect(deletedMessage).toBeUndefined();
    });

    it('应该拒绝删除他人的消息', async () => {
      const message = await messageService.sendMessage(
        chatSessionId,
        user1Id,
        'Another message',
        'text'
      );

      await expect(
        messageService.deleteMessage(message.id, user2Id)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('markMessagesAsRead', () => {
    it('应该标记消息为已读', async () => {
      // 发送消息
      await messageService.sendMessage(chatSessionId, user1Id, 'Unread message', 'text');

      // 标记为已读
      const result = await messageService.markMessagesAsRead(chatSessionId, user2Id);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });
  });
});
