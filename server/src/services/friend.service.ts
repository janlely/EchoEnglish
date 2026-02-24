import prisma from '../config/database';
import logger from '../utils/logger';

class FriendService {
  /**
   * 按邮箱精确搜索用户
   */
  async searchUserByEmail(email: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
        },
      });

      return user;
    } catch (error: any) {
      logger.error('Search user error:', error);
      throw error;
    }
  }

  /**
   * 发送好友请求
   */
  async sendFriendRequest(senderId: string, receiverId: string, message?: string) {
    try {
      // 检查是否已经是好友
      const existingFriendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId1: senderId, userId2: receiverId },
            { userId1: receiverId, userId2: senderId },
          ],
        },
      });

      if (existingFriendship) {
        throw new Error('Already friends');
      }

      // 检查是否已有待处理的请求
      const existingRequest = await prisma.friendRequest.findFirst({
        where: {
          senderId,
          receiverId,
          status: 'pending',
        },
      });

      if (existingRequest) {
        throw new Error('Friend request already sent');
      }

      // 创建好友请求
      const request = await prisma.friendRequest.create({
        data: {
          senderId,
          receiverId,
          message,
        },
      });

      // 创建通知
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'friend_request',
          title: '新的朋友请求',
          message: '有人想添加你为好友',
          data: JSON.stringify({ requestId: request.id, senderId }),
        },
      });

      logger.info(`Friend request sent from ${senderId} to ${receiverId}`);
      return request;
    } catch (error: any) {
      logger.error('Send friend request error:', error);
      throw error;
    }
  }

  /**
   * 获取收到的好友请求
   */
  async getReceivedRequests(userId: string) {
    try {
      const requests = await prisma.friendRequest.findMany({
        where: {
          receiverId: userId,
          status: 'pending',
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return requests;
    } catch (error: any) {
      logger.error('Get received requests error:', error);
      throw error;
    }
  }

  /**
   * 同意好友请求
   */
  async acceptFriendRequest(requestId: string, userId: string) {
    try {
      // 获取请求详情
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Friend request not found');
      }

      if (request.receiverId !== userId) {
        throw new Error('Unauthorized');
      }

      if (request.status !== 'pending') {
        throw new Error('Request already processed');
      }

      // 创建好友关系
      await prisma.friendship.create({
        data: {
          userId1: request.senderId,
          userId2: request.receiverId,
        },
      });

      // 更新请求状态
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'accepted' },
      });

      logger.info(`Friend request ${requestId} accepted, friendship created`);
      return { success: true };
    } catch (error: any) {
      logger.error('Accept friend request error:', error);
      throw error;
    }
  }

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(requestId: string, userId: string) {
    try {
      const request = await prisma.friendRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new Error('Friend request not found');
      }

      if (request.receiverId !== userId) {
        throw new Error('Unauthorized');
      }

      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });

      logger.info(`Friend request ${requestId} rejected`);
      return { success: true };
    } catch (error: any) {
      logger.error('Reject friend request error:', error);
      throw error;
    }
  }

  /**
   * 获取好友列表
   */
  async getFriends(userId: string) {
    try {
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { userId1: userId },
            { userId2: userId },
          ],
        },
        include: {
          user1: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              isOnline: true,
            },
          },
          user2: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              isOnline: true,
            },
          },
        },
      });

      // 提取好友信息
      const friends = friendships.map(f => {
        const friend = f.userId1 === userId ? f.user2 : f.user1;
        return friend;
      });

      return friends;
    } catch (error: any) {
      logger.error('Get friends error:', error);
      throw error;
    }
  }
}

export default new FriendService();
