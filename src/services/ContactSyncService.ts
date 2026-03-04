/**
 * 联系人同步服务
 * 
 * 负责：
 * - 增量同步好友和群组
 * - 管理同步游标
 * - 处理全量/增量同步逻辑
 */

import { Q, Database } from '@nozbe/watermelondb';
import { syncContacts, SyncContactsResult, Friend as ApiFriend, Group as ApiGroup } from '../api/contacts';
import { Friend, Group, GroupMember, SyncCursor } from '../database/models';
import logger from '../utils/logger';

// 全量同步阈值（30 天）
const FULL_SYNC_THRESHOLD = 30 * 24 * 60 * 60 * 1000;

export class ContactSyncService {
  private database: Database | null = null;

  /**
   * 设置数据库实例
   */
  setDatabase(database: Database) {
    this.database = database;
  }

  /**
   * 获取本地保存的同步游标
   */
  private async getSyncCursors(): Promise<{
    friendCursor?: string;
    groupCursor?: string;
    requestCursor?: string;
  }> {
    if (!this.database) {
      logger.warn('ContactSyncService', 'Database not available');
      return {};
    }

    try {
      const cursors = await this.database.collections
        .get<SyncCursor>('sync_cursors')
        .query()
        .fetch();

      if (cursors.length > 0) {
        const cursor = cursors[0];
        return {
          friendCursor: cursor.friendCursor,
          groupCursor: cursor.groupCursor,
          requestCursor: cursor.requestCursor,
        };
      }
      return {};
    } catch (error) {
      logger.error('ContactSyncService', 'Get sync cursors error:', error);
      return {};
    }
  }

  /**
   * 保存同步游标
   */
  private async saveSyncCursors(cursors: {
    friendCursor?: string;
    groupCursor?: string;
    requestCursor?: string;
  }): Promise<void> {
    if (!this.database) {
      logger.warn('ContactSyncService', 'Database not available');
      return;
    }

    try {
      await this.database.write(async () => {
        const existingCursors = await this.database!.collections
          .get<SyncCursor>('sync_cursors')
          .query()
          .fetch();

        if (existingCursors.length > 0) {
          // 更新现有游标
          await existingCursors[0].update((c: SyncCursor) => {
            c.friendCursor = cursors.friendCursor || '';
            c.groupCursor = cursors.groupCursor || '';
            c.requestCursor = cursors.requestCursor || '';
          });
        } else {
          // 创建新游标
          await this.database!.collections.get<SyncCursor>('sync_cursors').create((c: SyncCursor) => {
            c.friendCursor = cursors.friendCursor || '';
            c.groupCursor = cursors.groupCursor || '';
            c.requestCursor = cursors.requestCursor || '';
          });
        }
      });

      logger.debug('ContactSyncService', 'Sync cursors saved');
    } catch (error) {
      logger.error('ContactSyncService', 'Save sync cursors error:', error);
    }
  }

  /**
   * 判断是否需要全量同步
   */
  private async shouldFullSync(): Promise<boolean> {
    if (!this.database) return true;

    try {
      const cursors = await this.getSyncCursors();
      
      // 如果没有游标，需要全量同步
      if (!cursors.friendCursor && !cursors.groupCursor) {
        logger.debug('ContactSyncService', 'No cursors found, need full sync');
        return true;
      }

      // 检查游标是否太久远（30 天）
      // 游标是字符串格式的时间戳
      const friendTimestamp = cursors.friendCursor ? parseInt(cursors.friendCursor, 10) : 0;
      const now = Date.now();
      
      if (now - friendTimestamp > FULL_SYNC_THRESHOLD) {
        logger.debug('ContactSyncService', 'Cursors too old, need full sync');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('ContactSyncService', 'Check full sync error:', error);
      return true;
    }
  }

  /**
   * 执行同步
   */
  async syncContacts(): Promise<void> {
    if (!this.database) {
      logger.warn('ContactSyncService', 'Database not available, skip sync');
      return;
    }

    try {
      logger.info('ContactSyncService', 'Starting contact sync...');

      // 检查是否需要全量同步
      const needFullSync = await this.shouldFullSync();
      
      // 获取本地游标
      const cursors = await this.getSyncCursors();
      
      // 如果全量同步，不传游标
      const friendCursor = needFullSync ? undefined : cursors.friendCursor;
      const groupCursor = needFullSync ? undefined : cursors.groupCursor;
      const requestCursor = needFullSync ? undefined : cursors.requestCursor;

      logger.debug('ContactSyncService', `Sync mode: ${needFullSync ? 'FULL' : 'INCREMENTAL'}`);
      logger.debug('ContactSyncService', `Cursors: friend=${friendCursor}, group=${groupCursor}, request=${requestCursor}`);

      // 调用增量同步 API
      const result: SyncContactsResult = await syncContacts(friendCursor, groupCursor, requestCursor);

      logger.debug('ContactSyncService', `Sync result: ${result.friends.added.length} new friends, ${result.groups.added.length} new groups`);

      // 合并所有保存操作到一个 write 事务中
      await this.database.write(async () => {
        // 保存好友
        for (const friend of [...result.friends.added, ...result.friends.updated]) {
          const existing = await this.database!.collections
            .get<Friend>('friends')
            .query(Q.where('friend_id', Q.eq(friend.id)))
            .fetch();

          if (existing.length > 0) {
            await existing[0].update((f: Friend) => {
              f.name = friend.name;
              f.email = friend.email;
              f.avatarUrl = friend.avatarUrl || undefined;
              f.isOnline = friend.isOnline;
              f.updatedAt = Date.now();
            });
          } else {
            await this.database!.collections.get<Friend>('friends').create((f: Friend) => {
              f.friendId = friend.id;
              f.name = friend.name;
              f.email = friend.email;
              f.avatarUrl = friend.avatarUrl || undefined;
              f.isOnline = friend.isOnline;
              f.createdAt = Date.now();
              f.updatedAt = Date.now();
            });
          }
        }

        // 保存群组和群成员
        for (const group of [...result.groups.added, ...result.groups.updated]) {
          const existing = await this.database!.collections
            .get<Group>('groups')
            .query(Q.where('group_id', Q.eq(group.id)))
            .fetch();

          if (existing.length > 0) {
            await existing[0].update((g: Group) => {
              g.name = group.name;
              g.avatarUrl = group.avatarUrl || undefined;
              g.ownerId = group.ownerId;
              g.memberIds = JSON.stringify(group.memberIds);
              g.updatedAt = Date.now();
            });

            // 更新群成员
            if (group.members && group.members.length > 0) {
              for (const member of group.members) {
                const existingMembers = await this.database!.collections
                  .get<GroupMember>('group_members')
                  .query(
                    Q.and(
                      Q.where('group_id', Q.eq(group.id)),
                      Q.where('user_id', Q.eq(member.userId))
                    )
                  )
                  .fetch();

                if (existingMembers.length > 0) {
                  await existingMembers[0].update((m: GroupMember) => {
                    m.name = member.name;
                    m.avatarUrl = member.avatarUrl || undefined;
                    m.role = member.role;
                    m.updatedAt = Date.now();
                  });
                } else {
                  await this.database!.collections.get<GroupMember>('group_members').create((m: GroupMember) => {
                    m.groupId = group.id;
                    m.userId = member.userId;
                    m.name = member.name;
                    m.avatarUrl = member.avatarUrl || undefined;
                    m.role = member.role;
                    m.joinedAt = Date.now();
                    m.createdAt = Date.now();
                    m.updatedAt = Date.now();
                  });
                }
              }
            }
          } else {
            await this.database!.collections.get<Group>('groups').create((g: Group) => {
              g.groupId = group.id;
              g.name = group.name;
              g.avatarUrl = group.avatarUrl || undefined;
              g.ownerId = group.ownerId;
              g.memberIds = JSON.stringify(group.memberIds);
              g.createdAt = Date.now();
              g.updatedAt = Date.now();
            });

            // 创建群成员
            if (group.members && group.members.length > 0) {
              for (const member of group.members) {
                await this.database!.collections.get<GroupMember>('group_members').create((m: GroupMember) => {
                  m.groupId = group.id;
                  m.userId = member.userId;
                  m.name = member.name;
                  m.avatarUrl = member.avatarUrl || undefined;
                  m.role = member.role;
                  m.joinedAt = Date.now();
                  m.createdAt = Date.now();
                  m.updatedAt = Date.now();
                });
              }
            }
          }
        }

        // 保存新游标
        const existingCursors = await this.database!.collections
          .get<SyncCursor>('sync_cursors')
          .query()
          .fetch();

        if (existingCursors.length > 0) {
          await existingCursors[0].update((c: SyncCursor) => {
            c.friendCursor = result.newFriendCursor || '';
            c.groupCursor = result.newGroupCursor || '';
            c.requestCursor = result.newRequestCursor || '';
          });
        } else {
          await this.database!.collections.get<SyncCursor>('sync_cursors').create((c: SyncCursor) => {
            c.friendCursor = result.newFriendCursor || '';
            c.groupCursor = result.newGroupCursor || '';
            c.requestCursor = result.newRequestCursor || '';
          });
        }
      });

      logger.info('ContactSyncService', 'Contact sync completed');
    } catch (error) {
      logger.error('ContactSyncService', 'Sync contacts error:', error);
      // Don't throw - allow app to continue even if sync fails
    }
  }

  /**
   * 重置同步游标（用于强制全量同步）
   */
  async resetSyncCursors(): Promise<void> {
    if (!this.database) return;

    try {
      await this.database.write(async () => {
        const existingCursors = await this.database!.collections
          .get<SyncCursor>('sync_cursors')
          .query()
          .fetch();

        if (existingCursors.length > 0) {
          await existingCursors[0].update((c: SyncCursor) => {
            c.friendCursor = '';
            c.groupCursor = '';
            c.requestCursor = '';
          });
        }
      });
      logger.info('ContactSyncService', 'Sync cursors reset');
    } catch (error) {
      logger.error('ContactSyncService', 'Reset sync cursors error:', error);
    }
  }
}

// 导出单例
export const contactSyncService = new ContactSyncService();
export default contactSyncService;
