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
      const startTime = Date.now();
      logger.info(`[ContactService] Sync contacts for user ${userId}, friendCursor=${friendCursor}, groupCursor=${groupCursor}, requestCursor=${requestCursor}`);

      // 同步好友
      const friendsStart = Date.now();
      const friends = await this.syncFriends(userId, friendCursor);
      logger.info(`[ContactService] Sync friends completed in ${Date.now() - friendsStart}ms`);

      // 同步群组
      const groupsStart = Date.now();
      const groups = await this.syncGroups(userId, groupCursor);
      logger.info(`[ContactService] Sync groups completed in ${Date.now() - groupsStart}ms`);

      // 同步好友请求
      const requestsStart = Date.now();
      const friendRequests = await this.syncFriendRequests(userId, requestCursor);
      logger.info(`[ContactService] Sync friend requests completed in ${Date.now() - requestsStart}ms`);

      // 计算新游标（使用当前时间戳）
      const newFriendCursor = BigInt(Date.now());
      const newGroupCursor = BigInt(Date.now());
      const newRequestCursor = BigInt(Date.now());

      // 更新游标
      const cursorStart = Date.now();
      await this.updateSyncCursor(userId, newFriendCursor, newGroupCursor, newRequestCursor);
      logger.info(`[ContactService] Update cursor completed in ${Date.now() - cursorStart}ms`);

      const totalTime = Date.now() - startTime;
      logger.info(`[ContactService] Total sync completed in ${totalTime}ms - friends: ${friends.added.length} added, ${friends.updated.length} updated; groups: ${groups.added.length} added, ${groups.updated.length} updated; requests: ${friendRequests.added.length} added`);

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
      const startTime = Date.now();
      logger.info(`[ContactService] Sync friends start - userId=${userId}, cursor=${cursor}`);

      // 获取当前好友列表
      const queryStart = Date.now();
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
      logger.info(`[ContactService] Friendship query completed in ${Date.now() - queryStart}ms, found ${friendships.length} friendships`);

      // 提取好友信息
      const processStart = Date.now();
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
      logger.info(`[ContactService] Process friends completed in ${Date.now() - processStart}ms`);

      // 过滤变更
      const filterStart = Date.now();
      const added = currentFriends.filter(f => f.updatedAt > Number(cursor));
      const updated = currentFriends.filter(f => f.updatedAt <= cursor && f.updatedAt > 0);
      const removed: string[] = []; // 简化处理，暂不跟踪删除
      logger.info(`[ContactService] Filter friends completed in ${Date.now() - filterStart}ms - added=${added.length}, updated=${updated.length}`);

      logger.info(`[ContactService] Sync friends total: ${Date.now() - startTime}ms`);

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
      const startTime = Date.now();
      logger.info(`[ContactService] Sync groups start - userId=${userId}, cursor=${cursor}`);

      // 获取用户加入的所有群组
      const queryStart = Date.now();
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
      const queryTime = Date.now() - queryStart;
      logger.info(`[ContactService] Group membership query completed in ${queryTime}ms, found ${groupMemberships.length} groups`);

      // 提取群组信息（包含成员详情）
      const processStart = Date.now();
      const currentGroups = groupMemberships.map(m => ({
        id: m.group.id,
        name: m.group.name,
        avatarUrl: m.group.avatarUrl,
        ownerId: m.group.ownerId,
        memberIds: m.group.members.map(member => member.userId),
        members: m.group.members.map(member => ({
          userId: member.user.id,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
          role: member.role as 'owner' | 'admin' | 'member',
        })),
        updatedAt: m.group.updatedAt.getTime(),
      }));
      logger.info(`[ContactService] Process groups completed in ${Date.now() - processStart}ms`);

      // 增量同步逻辑：
      // 1. cursor === 0n: 第一次同步，返回所有群组
      // 2. cursor > 0n: 增量同步，只返回更新的群组
      const filterStart = Date.now();
      let added: typeof currentGroups = [];
      let updated: typeof currentGroups = [];

      if (cursor === 0n) {
        // First sync: return all groups as "added"
        added = currentGroups;
        updated = [];
        logger.info(`[ContactService] First sync - returning all ${currentGroups.length} groups`);
      } else {
        // Incremental sync: only return groups updated since last sync
        const cursorTimestamp = Number(cursor);
        added = currentGroups.filter(g => g.updatedAt > cursorTimestamp);
        // For incremental sync, we return updated groups separately
        // (groups that existed before and were modified)
        updated = []; // Simplified: treat all changes as "added"
        logger.info(`[ContactService] Incremental sync - cursor=${cursorTimestamp}, returning ${added.length} updated groups`);
      }
      logger.info(`[ContactService] Filter groups completed in ${Date.now() - filterStart}ms - added=${added.length}, updated=${updated.length}`);

      const removed: string[] = []; // 简化处理，暂不跟踪删除

      const totalTime = Date.now() - startTime;
      logger.info(`[ContactService] Sync groups total: ${totalTime}ms - cursor=${cursor}, currentGroups=${currentGroups.length}, added=${added.length}`);

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
   * 获取单个群信息
   */
  async getGroup(userId: string, groupId: string) {
    try {
      // Verify user is a member of this group
      const membership = await prisma.groupMember.findFirst({
        where: {
          groupId,
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

      if (!membership) {
        throw new Error('Access denied: User is not a member of this group');
      }

      return {
        id: membership.group.id,
        name: membership.group.name,
        avatarUrl: membership.group.avatarUrl,
        ownerId: membership.group.ownerId,
        memberCount: membership.group.members.length,
        members: membership.group.members.map(member => ({
          userId: member.user.id,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
        })),
      };
    } catch (error: any) {
      logger.error('[ContactService] Get group error:', error);
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

  /**
   * 更新群组名称
   */
  async updateGroupName(groupId: string, name: string, userId: string) {
    try {
      // 检查用户是否是群主
      const groupMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });

      if (!groupMember || groupMember.role !== 'owner') {
        throw new Error('Unauthorized: Only group owner can update group name');
      }

      // 更新群组名称
      const updatedGroup = await prisma.group.update({
        where: {
          id: groupId,
        },
        data: {
          name,
        },
      });

      logger.info(`[ContactService] Updated group name for group: ${groupId}`);
      return updatedGroup;
    } catch (error: any) {
      logger.error('[ContactService] Update group name error:', error);
      throw error;
    }
  }
}

export default new ContactService();
