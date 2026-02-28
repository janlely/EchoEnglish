// 在每个测试之后清理数据库
import prisma from '../src/config/database';

export default async () => {
  try {
    // 删除所有数据（按依赖关系倒序）
    await prisma.notification.deleteMany();
    await prisma.message.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await prisma.friendship.deleteMany();
    await prisma.friendRequest.deleteMany();
    await prisma.userSetting.deleteMany();
    await prisma.user.deleteMany();
  } catch (error) {
    console.error('Database cleanup failed:', error);
  }
};
