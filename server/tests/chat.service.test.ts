import chatService from '../src/services/chat.service';
import authService from '../src/services/auth.service';

// 使用测试数据库
const TEST_DATABASE_URL = 'file:./test.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;

// 生成唯一邮箱
const generateEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

describe('Chat Service', () => {
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;

  // 在每个测试前清理数据并创建测试用户
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
    const [user1, user2, user3] = await Promise.all([
      authService.register(
        generateEmail('chatuser1'),
        'password123',
        'Chat User 1'
      ),
      authService.register(
        generateEmail('chatuser2'),
        'password123',
        'Chat User 2'
      ),
      authService.register(
        generateEmail('chatuser3'),
        'password123',
        'Chat User 3'
      )
    ]);

    user1Id = user1.id;
    user2Id = user2.id;
    user3Id = user3.id;
  });

  describe('createChatSession', () => {
    it('应该成功创建一对一聊天', async () => {
      const session = await chatService.createChatSession(
        user1Id,
        [user2Id],
        undefined,
        'direct'
      );

      expect(session).toBeDefined();
      expect(session.type).toBe('direct');
      expect(session.participants).toHaveLength(2);
    });

    it('应该成功创建群聊', async () => {
      // 创建群聊前确保有足够用户
      const session = await chatService.createChatSession(
        user1Id,
        [user2Id, user3Id],
        'Group Chat',
        'group'
      );

      expect(session).toBeDefined();
      expect(session.type).toBe('group');
      expect(session.name).toBe('Group Chat');
      expect(session.participants.length).toBe(3);
    });

    it('对于相同的用户应该返回现有的聊天会话', async () => {
      // 创建第一个聊天
      const session1 = await chatService.createChatSession(
        user1Id,
        [user2Id],
        undefined,
        'direct'
      );

      // 尝试创建相同的聊天（从 user2 的角度）
      const session2 = await chatService.createChatSession(
        user2Id,
        [user1Id],
        undefined,
        'direct'
      );

      // 应该返回同一个会话
      expect(session1.id).toBe(session2.id);
    });
  });

  describe('getUserChatSessions', () => {
    it('应该获取用户的聊天列表', async () => {
      // 创建聊天
      await chatService.createChatSession(
        user1Id,
        [user2Id],
        undefined,
        'direct'
      );

      const result = await chatService.getUserChatSessions(user1Id, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('应该支持分页', async () => {
      // 创建多个聊天以测试分页
      await chatService.createChatSession(
        user1Id,
        [user2Id],
        undefined,
        'direct'
      );
      await chatService.createChatSession(
        user1Id,
        [user3Id],
        undefined,
        'direct'
      );

      const result = await chatService.getUserChatSessions(user1Id, {
        page: 1,
        limit: 5,
      });

      expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
      expect(result.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getChatSession', () => {
    it('应该获取聊天详情', async () => {
      const session = await chatService.createChatSession(
        user1Id,
        [user2Id],
        undefined,
        'direct'
      );

      const details = await chatService.getChatSession(session.id, user1Id);

      expect(details).toBeDefined();
      expect(details.id).toBe(session.id);
      expect(details.participants).toBeDefined();
    });

    it('应该拒绝访问非参与者的聊天', async () => {
      const session = await chatService.createChatSession(
        user1Id,
        [user2Id],
        undefined,
        'direct'
      );

      // user3 不是参与者
      await expect(
        chatService.getChatSession(session.id, user3Id)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('markChatAsRead', () => {
    it('应该标记聊天为已读', async () => {
      const session = await chatService.createChatSession(
        user1Id,
        [user2Id],
        undefined,
        'direct'
      );

      const result = await chatService.markChatAsRead(session.id, user1Id);

      expect(result.success).toBe(true);
    });
  });
});
