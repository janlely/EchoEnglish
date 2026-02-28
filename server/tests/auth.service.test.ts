import bcrypt from 'bcryptjs';
import authService from '../src/services/auth.service';
import prisma from '../src/config/database';

// 使用测试数据库
const TEST_DATABASE_URL = 'file:./test.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;

// 生成唯一邮箱
const generateEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;

describe('Auth Service', () => {
  // 在每个测试前清理数据（按依赖关系倒序）
  beforeEach(async () => {
    const { prisma } = await import('../src/config/database');
    try {
      // 清理测试数据
      await prisma.notification.deleteMany();
      await prisma.message.deleteMany();
      await prisma.groupMember.deleteMany();
      await prisma.group.deleteMany();
      await prisma.friendship.deleteMany();
      await prisma.friendRequest.deleteMany();
      await prisma.userSetting.deleteMany();
      await prisma.user.deleteMany();
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  });

  describe('register', () => {
    it('应该成功注册新用户', async () => {
      const email = generateEmail('test');
      const password = 'password123';
      const name = 'Test User';

      const user = await authService.register(email, password, name);

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.name).toBe(name);
      expect(user.id).toBeDefined();
    });

    it('应该拒绝重复的邮箱', async () => {
      const email = generateEmail('duplicate');
      const password = 'password123';
      const name = 'Test User';

      // 第一次注册
      await authService.register(email, password, name);

      // 第二次注册应该失败
      await expect(
        authService.register(email, password, name)
      ).rejects.toThrow('Email already registered');
    });

    it('应该正确加密密码', async () => {
      const email = generateEmail('encrypt');
      const password = 'password123';
      const name = 'Test User';

      await authService.register(email, password, name);

      // 从数据库检查密码是否加密
      const dbUser = await prisma.user.findUnique({
        where: { email },
      });

      expect(dbUser?.passwordHash).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe(password);
      
      // 验证密码哈希
      const isValid = await bcrypt.compare(password, dbUser!.passwordHash!);
      expect(isValid).toBe(true);
    });
  });

  describe('login', () => {
    let testEmail: string;
    const password = 'password123';

    beforeEach(async () => {
      testEmail = generateEmail('login');
      await authService.register(testEmail, password, 'Login User');
    });

    it('应该成功登录', async () => {
      const result = await authService.login(testEmail, password);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testEmail);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('应该拒绝错误的密码', async () => {
      await expect(
        authService.login(testEmail, 'wrongpassword')
      ).rejects.toThrow('Invalid email or password');
    });

    it('应该拒绝不存在的用户', async () => {
      await expect(
        authService.login(generateEmail('notexist'), 'password123')
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refreshAccessToken', () => {
    let testEmail: string;
    let refreshToken: string;
    let accessToken: string;

    beforeEach(async () => {
      testEmail = generateEmail('refresh');
      const password = 'password123';
      await authService.register(testEmail, password, 'Refresh User');
      const loginResult = await authService.login(testEmail, password);
      refreshToken = loginResult.refreshToken;
      accessToken = loginResult.accessToken;
    });

    it('应该成功刷新 access token', async () => {
      const refreshResult = authService.refreshAccessToken(refreshToken);

      expect(refreshResult.accessToken).toBeDefined();
    });

    it('应该拒绝无效的 refresh token', () => {
      expect(() => {
        authService.refreshAccessToken('invalid-token');
      }).toThrow('Invalid refresh token');
    });

    it('应该拒绝 access token 作为刷新 token', () => {
      expect(() => {
        authService.refreshAccessToken(accessToken);
      }).toThrow('Invalid token type');
    });
  });

  describe('getUserById', () => {
    let testUserId: string;

    beforeEach(async () => {
      const testEmail = generateEmail('getuser');
      const user = await authService.register(testEmail, 'password123', 'Get User');
      testUserId = user.id;
    });

    it('应该通过 ID 获取用户', async () => {
      const fetchedUser = await authService.getUserById(testUserId);

      expect(fetchedUser).toBeDefined();
      expect(fetchedUser?.id).toBe(testUserId);
    });

    it('应该返回 null 对于不存在的用户', async () => {
      const user = await authService.getUserById('non-existent-id');
      expect(user).toBeNull();
    });
  });
});
