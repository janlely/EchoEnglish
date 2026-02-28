import prisma from '../config/database';
import logger from '../utils/logger';

interface FriendSyncResult {
  added: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    isOnline: boolean;
  }>;
  updated: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    isOnline: boolean;
  }>;
  removed: string[];
}

interface GroupSyncResult {
  added: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    ownerId: string;
    memberIds: string[];
  }>;
  updated: Array<{
    id: string;
    name: string;
    avatarUrl?: string | null;
    ownerId: string;
    memberIds: string[];
  }>;
  removed: string[];
}

interface FriendRequestSyncResult {
  added: Array<{
    id: string;
    sender: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
    };
    message?: string;
    createdAt: string;
  }>;
  removed: string[];
}

interface SyncContactsResult {
  friends: FriendSyncResult;
  groups: GroupSyncResult;
  friendRequests: FriendRequestSyncResult;
  newFriendCursor: string;
  newGroupCursor: string;
  newRequestCursor: string;
}

class ContactService {
  /**
   * 增量同步联系人
   */
  async syncContacts(
    userId: string,
    friendCursor: bigint,
    groupCursor: bigint,
    requestCursor: bigint
  ): Promise<SyncContactsResult> {
    try {
      logger.info(`[ContactService] Sync contacts for user ${userId}, friendCursor=${friendCursor}, groupCursor=${groupCursor}, requestCursor=${requestCursor}`);

      // 同步好友
      const friends = await this.syncFriends(userId, friendCursor);

      // 同步群组
      const groups = await this.syncGroups(userId, groupCursor);

      // 同步好友请求
      const friendRequests = await this.syncFriendRequests(userId, requestCursor);

      // 计算新游标（使用当前时间戳）
      const newFriendCursor = BigInt(Date.now());
      const newGroupCursor = BigInt(Date.now());
      const newRequestCursor = BigInt(Date.now());

      // 更新游标
      await this.updateSyncCursor(userId, newFriendCursor, newGroupCursor, newRequestCursor);

      return {
        friends,
        groups,
        friendRequests,
        newFriendCursor: newFriendCursor.toString(),
        newGroupCursor: newGroupCursor.toString(),
        newRequestCursor: newRequestCursor.toString(),
      };
    } catch (error: any) {
      logger.error('[ContactService] Sync contacts error:', error);
      throw error;
    }
  }

  /**
   * 增量同步好友请求
   */
  private async syncFriendRequests(userId: string, cursor: bigint): Promise<FriendRequestSyncResult> {
    try {
      // 获取当前用户的好友请求（只获取未处理的）
      const requests = await prisma.friendRequest.findMany({
        where: {
          receiverId: userId,
          status: 'pending',
          createdAt: {
            gt: new Date(Number(cursor)),
          },
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

      const added = requests.map(r => ({
        id: r.id,
        sender: {
          id: r.sender!.id,
          name: r.sender!.name,
          email: r.sender!.email,
          avatarUrl: r.sender!.avatarUrl,
        },
        message: r.message || undefined,
        createdAt: r.createdAt.toISOString(),
      }));

      // 获取已处理（接受或拒绝）的请求 ID 列表（用于前端移除）
      const processedRequests = await prisma.friendRequest.findMany({
        where: {
          receiverId: userId,
          status: {
            in: ['accepted', 'rejected'],
          },
          updatedAt: {
            gt: new Date(Number(cursor)),
          },
        },
      });

      const removed = processedRequests.map(r => r.id);

      return {
        added,
        removed,
      };
    } catch (error: any) {
      logger.error('[ContactService] Sync friend requests error:', error);
      throw error;
    }
  }

  /**
   * 增量同步好友
   */
  private async syncFriends(userId: string, cursor: bigint): Promise<FriendSyncResult> {
    try {
      // 获取当前好友列表
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
              updatedAt: true,
            },
          },
          user2: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              isOnline: true,
              updatedAt: true,
            },
          },
        },
      });

      // 提取好友信息
      const currentFriends = friendships.map(f => {
        const friend = f.userId1 === userId ? f.user2 : f.user1;
        return {
          id: friend.id,
          name: friend.name,
          email: friend.email,
          avatarUrl: friend.avatarUrl,
          isOnline: friend.isOnline,
          updatedAt: friend.updatedAt.getTime(),
        };
      });

      // 获取本地已有的好友 ID（通过游标时间之前的）
      // 注意：这里简化处理，返回所有当前好友作为 added
      // 实际生产中应该记录用户的好友列表快照
      const added = currentFriends.filter(f => f.updatedAt > cursor);
      const updated = currentFriends.filter(f => f.updatedAt <= cursor && f.updatedAt > 0);
      const removed: string[] = []; // 简化处理，暂不跟踪删除

      logger.info(`[ContactService] Sync friends: added=${added.length}, updated=${updated.length}, removed=${removed.length}`);

      return {
        added: added.map(({ updatedAt, ...rest }) => rest),
        updated: updated.map(({ updatedAt, ...rest }) => rest),
        removed,
      };
    } catch (error: any) {
      logger.error('[ContactService] Sync friends error:', error);
      throw error;
    }
  }

  /**
   * 增量同步群组
   */
  private async syncGroups(userId: string, cursor: bigint): Promise<GroupSyncResult> {
    try {
      // 获取用户加入的所有群组
      const groupMemberships = await prisma.groupMember.findMany({
        where: {
          userId,
        },
        include: {
          group: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // 提取群组信息
      const currentGroups = groupMemberships.map(m => ({
        id: m.group.id,
        name: m.group.name,
        avatarUrl: m.group.avatarUrl,
        ownerId: m.group.ownerId,
        memberIds: m.group.members.map(member => member.userId),
        updatedAt: m.group.updatedAt.getTime(),
      }));

      // 过滤变更
      const added = currentGroups.filter(g => g.updatedAt > cursor);
      const updated = currentGroups.filter(g => g.updatedAt <= cursor && g.updatedAt > 0);
      const removed: string[] = []; // 简化处理，暂不跟踪删除

      logger.info(`[ContactService] Sync groups: added=${added.length}, updated=${updated.length}, removed=${removed.length}`);

      return {
        added: added.map(({ updatedAt, ...rest }) => rest),
        updated: updated.map(({ updatedAt, ...rest }) => rest),
        removed,
      };
    } catch (error: any) {
      logger.error('[ContactService] Sync groups error:', error);
      throw error;
    }
  }

  /**
   * 更新同步游标
   */
  private async updateSyncCursor(
    userId: string,
    friendCursor: bigint,
    groupCursor: bigint,
    requestCursor: bigint
  ) {
    try {
      await prisma.contactSyncCursor.upsert({
        where: {
          userId,
        },
        update: {
          friendCursor,
          groupCursor,
          requestCursor,
        },
        create: {
          userId,
          friendCursor,
          groupCursor,
          requestCursor,
        },
      });

      logger.info(`[ContactService] Updated sync cursor for user ${userId}`);
    } catch (error: any) {
      logger.error('[ContactService] Update sync cursor error:', error);
      throw error;
    }
  }

  /**
   * 获取同步游标
   */
  async getSyncCursor(userId: string): Promise<{ friendCursor: bigint; groupCursor: bigint; requestCursor: bigint }> {
    try {
      const cursor = await prisma.contactSyncCursor.findUnique({
        where: {
          userId,
        },
      });

      return {
        friendCursor: cursor?.friendCursor ?? 0n,
        groupCursor: cursor?.groupCursor ?? 0n,
        requestCursor: cursor?.requestCursor ?? 0n,
      };
    } catch (error: any) {
      logger.error('[ContactService] Get sync cursor error:', error);
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
      logger.error('[ContactService] Get friends error:', error);
      throw error;
    }
  }

  /**
   * 获取群组列表
   */
  async getGroups(userId: string) {
    try {
      const groupMemberships = await prisma.groupMember.findMany({
        where: {
          userId,
        },
        include: {
          group: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // 提取群组信息
      const groups = groupMemberships.map(m => ({
        id: m.group.id,
        name: m.group.name,
        avatarUrl: m.group.avatarUrl,
        ownerId: m.group.ownerId,
        memberCount: m.group.members.length,
        members: m.group.members.map(member => ({
          id: member.user.id,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
        })),
      }));

      return groups;
    } catch (error: any) {
      logger.error('[ContactService] Get groups error:', error);
      throw error;
    }
  }

  /**
   * 创建群组
   */
  async createGroup(ownerId: string, name: string, avatarUrl?: string, memberIds: string[] = []) {
    try {
      // 创建群组
      const group = await prisma.group.create({
        data: {
          name,
          avatarUrl,
          ownerId,
        },
      });

      // 添加群主为成员
      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: ownerId,
          role: 'owner',
        },
      });

      // 添加其他成员
      for (const memberId of memberIds) {
        if (memberId !== ownerId) {
          await prisma.groupMember.create({
            data: {
              groupId: group.id,
              userId: memberId,
              role: 'member',
            },
          });
        }
      }

      logger.info(`[ContactService] Created group: ${group.id}`);
      return group;
    } catch (error: any) {
      logger.error('[ContactService] Create group error:', error);
      throw error;
    }
  }

  /**
   * 添加群成员
   */
  async addGroupMember(groupId: string, userId: string, operatorId: string) {
    try {
      // 检查操作者是否是群主或管理员
      const operatorMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: operatorId,
          },
        },
      });

      if (!operatorMember || !['owner', 'admin'].includes(operatorMember.role)) {
        throw new Error('Unauthorized');
      }

      // 添加成员
      const member = await prisma.groupMember.create({
        data: {
          groupId,
          userId,
          role: 'member',
        },
      });

      logger.info(`[ContactService] Added member ${userId} to group ${groupId}`);
      return member;
    } catch (error: any) {
      logger.error('[ContactService] Add group member error:', error);
      throw error;
    }
  }

  /**
   * 移除群成员
   */
  async removeGroupMember(groupId: string, userId: string, operatorId: string) {
    try {
      // 检查操作者是否是群主或管理员
      const operatorMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: operatorId,
          },
        },
      });

      if (!operatorMember || !['owner', 'admin'].includes(operatorMember.role)) {
        throw new Error('Unauthorized');
      }

      // 移除成员
      await prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      logger.info(`[ContactService] Removed member ${userId} from group ${groupId}`);
      return { success: true };
    } catch (error: any) {
      logger.error('[ContactService] Remove group member error:', error);
      throw error;
    }
  }
}

export default new ContactService();
