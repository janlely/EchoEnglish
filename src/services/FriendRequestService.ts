/**
 * 好友申请服务
 * 
 * 负责：
 * - 获取和管理好友申请
 * - 未读计数管理
 * - WebSocket 实时通知
 * - 本地持久化
 */

import { Q, Database } from '@nozbe/watermelondb';
import {
  getPendingFriendRequests,
  getFriendRequestUnreadCount,
  acceptFriendRequest as apiAcceptFriendRequest,
  rejectFriendRequest as apiRejectFriendRequest,
  markAllFriendRequestsAsRead as apiMarkAllFriendRequestsAsRead,
  FriendRequest as ApiFriendRequest,
} from '../api/contacts';
import { FriendRequest } from '../database/models';
import logger from '../utils/logger';

// WebSocket 事件类型
interface FriendRequestWebSocketEvent {
  type: 'friend_request';
  data: {
    requestId: string;
    sender: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
    };
    message?: string;
    createdAt: string;
  };
}

export class FriendRequestService {
  private database: Database | null = null;
  private unreadCountListeners: ((count: number) => void)[] = [];
  private wsListenerCleanup: (() => void) | null = null;

  /**
   * 设置数据库实例
   */
  setDatabase(database: Database) {
    this.database = database;
  }

  /**
   * 添加未读计数监听器
   */
  addUnreadCountListener(listener: (count: number) => void) {
    this.unreadCountListeners.push(listener);
    // 立即触发一次（延迟执行，确保 database 已设置）
    setTimeout(() => {
      this.getUnreadCount().then(listener);
    }, 100);
    
    return () => {
      this.unreadCountListeners = this.unreadCountListeners.filter(l => l !== listener);
    };
  }

  /**
   * 通知所有监听器未读计数变化
   */
  private notifyUnreadCountChange(count: number) {
    this.unreadCountListeners.forEach(listener => {
      try {
        listener(count);
      } catch (error) {
        logger.error('FriendRequestService', 'Notify listener error:', error);
      }
    });
  }

  // Track ongoing getUnreadCount request to prevent duplicate calls
  private pendingUnreadCountPromise: Promise<number> | null = null;

  /**
   * 获取本地未读好友申请数量
   */
  async getUnreadCount(): Promise<number> {
    if (!this.database) {
      // Database not available, return 0 silently (don't log error for normal case)
      return 0;
    }

    // If there's already an unread count request in progress, return the same promise
    if (this.pendingUnreadCountPromise) {
      return this.pendingUnreadCountPromise;
    }

    // Create a new unread count promise
    this.pendingUnreadCountPromise = this.performGetUnreadCount();
    
    try {
      return await this.pendingUnreadCountPromise;
    } finally {
      // Clear the pending promise when done
      this.pendingUnreadCountPromise = null;
    }
  }

  private async performGetUnreadCount(): Promise<number> {
    try {
      const requests = await this.database!.collections
        .get<FriendRequest>('friend_requests')
        .query(
          Q.and(
            Q.where('status', Q.eq('pending')),
            Q.where('is_read', Q.eq(false))
          )
        )
        .fetch();

      return requests.length;
    } catch (error) {
      logger.error('FriendRequestService', 'Get unread count error:', error);
      return 0;
    }
  }

  // Track ongoing sync request to prevent duplicate calls
  private pendingSyncPromise: Promise<void> | null = null;

  /**
   * 同步待处理的好友申请（登录时调用）
   */
  async syncPendingRequests(): Promise<void> {
    if (!this.database) {
      logger.warn('FriendRequestService', 'Database not available, skip sync');
      return;
    }

    // If there's already a sync in progress, return the same promise
    if (this.pendingSyncPromise) {
      logger.debug('FriendRequestService', 'Sync already in progress, returning existing promise');
      return this.pendingSyncPromise;
    }

    // Create a new sync promise
    this.pendingSyncPromise = this.performSyncPendingRequests();
    
    try {
      await this.pendingSyncPromise;
    } finally {
      // Clear the pending promise when done
      this.pendingSyncPromise = null;
    }
  }

  private async performSyncPendingRequests(): Promise<void> {
    try {
      logger.info('FriendRequestService', 'Syncing pending friend requests...');

      // 从服务器获取待处理申请
      const result = await getPendingFriendRequests();

      logger.debug('FriendRequestService', `Synced ${result.requests.length} pending requests, unread: ${result.unreadCount}`);

      // 保存到本地数据库
      await this.saveFriendRequests(result.requests);

      // 通知未读计数变化
      this.notifyUnreadCountChange(result.unreadCount);

      logger.info('FriendRequestService', 'Friend request sync completed');
    } catch (error: any) {
      // API 不存在时静默失败（后端未实现）
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        logger.warn('FriendRequestService', 'Friend request API not implemented on backend, skipping sync');
        this.notifyUnreadCountChange(0);
      } else {
        logger.error('FriendRequestService', 'Sync pending requests error:', error);
        throw error;
      }
    }
  }

  /**
   * 保存好友申请到本地数据库
   */
  private async saveFriendRequests(requests: ApiFriendRequest[]): Promise<void> {
    if (!this.database || requests.length === 0) return;

    try {
      await this.database.write(async () => {
        for (const apiRequest of requests) {
          const existing = await this.database!.collections
            .get<FriendRequest>('friend_requests')
            .query(Q.where('request_id', Q.eq(apiRequest.id)))
            .fetch();

          if (existing.length > 0) {
            // 更新现有申请
            await existing[0].update((r: FriendRequest) => {
              r.senderId = apiRequest.sender.id;
              r.senderName = apiRequest.sender.name;
              r.senderEmail = apiRequest.sender.email;
              r.senderAvatar = apiRequest.sender.avatarUrl || undefined;
              r.message = apiRequest.message;
              r.status = apiRequest.status;
              r.updatedAt = Date.now();
            });
          } else {
            // 创建新申请
            await this.database!.collections.get<FriendRequest>('friend_requests').create((r: FriendRequest) => {
              r.requestId = apiRequest.id;
              r.senderId = apiRequest.sender.id;
              r.senderName = apiRequest.sender.name;
              r.senderEmail = apiRequest.sender.email;
              r.senderAvatar = apiRequest.sender.avatarUrl || undefined;
              r.message = apiRequest.message;
              r.status = apiRequest.status;
              r.isRead = false; // 新申请默认为未读
              r.createdAt = new Date(apiRequest.createdAt).getTime();
              r.updatedAt = Date.now();
            });
          }
        }
      });

      logger.debug('FriendRequestService', `Saved ${requests.length} friend requests`);
    } catch (error) {
      logger.error('FriendRequestService', 'Save friend requests error:', error);
    }
  }

  /**
   * 接受好友申请
   */
  async acceptFriendRequest(requestId: string): Promise<void> {
    try {
      await apiAcceptFriendRequest(requestId);

      // 更新本地状态
      if (this.database) {
        await this.database.write(async () => {
          const requests = await this.database!.collections
            .get<FriendRequest>('friend_requests')
            .query(Q.where('request_id', Q.eq(requestId)))
            .fetch();

          if (requests.length > 0) {
            await requests[0].update((r: FriendRequest) => {
              r.status = 'accepted';
              r.updatedAt = Date.now();
            });
          }
        });

        // 通知未读计数变化
        const unreadCount = await this.getUnreadCount();
        this.notifyUnreadCountChange(unreadCount);
      }

      logger.info('FriendRequestService', 'Friend request accepted:', requestId);
    } catch (error) {
      logger.error('FriendRequestService', 'Accept friend request error:', error);
      throw error;
    }
  }

  /**
   * 拒绝好友申请
   */
  async rejectFriendRequest(requestId: string): Promise<void> {
    try {
      await apiRejectFriendRequest(requestId);

      // 更新本地状态
      if (this.database) {
        await this.database.write(async () => {
          const requests = await this.database!.collections
            .get<FriendRequest>('friend_requests')
            .query(Q.where('request_id', Q.eq(requestId)))
            .fetch();

          if (requests.length > 0) {
            await requests[0].update((r: FriendRequest) => {
              r.status = 'rejected';
              r.updatedAt = Date.now();
            });
          }
        });

        // 通知未读计数变化
        const unreadCount = await this.getUnreadCount();
        this.notifyUnreadCountChange(unreadCount);
      }

      logger.info('FriendRequestService', 'Friend request rejected:', requestId);
    } catch (error) {
      logger.error('FriendRequestService', 'Reject friend request error:', error);
      throw error;
    }
  }

  /**
   * 标记所有好友申请为已读
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiMarkAllFriendRequestsAsRead();

      // 更新本地状态
      if (this.database) {
        await this.database.write(async () => {
          const requests = await this.database!.collections
            .get<FriendRequest>('friend_requests')
            .query(
              Q.and(
                Q.where('status', Q.eq('pending')),
                Q.where('is_read', Q.eq(false))
              )
            )
            .fetch();

          for (const request of requests) {
            await request.update((r: FriendRequest) => {
              r.isRead = true;
              r.updatedAt = Date.now();
            });
          }
        });

        // 通知未读计数变化（清零）
        this.notifyUnreadCountChange(0);
      }

      logger.info('FriendRequestService', 'All friend requests marked as read');
    } catch (error) {
      logger.error('FriendRequestService', 'Mark all as read error:', error);
      throw error;
    }
  }

  /**
   * 处理 WebSocket 好友申请事件
   */
  handleWebSocketEvent(event: FriendRequestWebSocketEvent) {
    logger.info('FriendRequestService', 'Received friend request WebSocket event:', event);

    if (!this.database) return;

    const { data } = event;

    // 保存新申请到本地
    this.saveFriendRequests([{
      id: data.requestId,
      sender: data.sender,
      message: data.message,
      status: 'pending',
      createdAt: data.createdAt,
    }]).then(() => {
      // 通知未读计数 +1
      this.getUnreadCount().then(count => {
        this.notifyUnreadCountChange(count);
      });
    });
  }

  /**
   * 开始 WebSocket 监听
   */
  startWebSocketListener(onMessage: (callback: (data: any) => void) => () => void) {
    // 清理之前的监听
    if (this.wsListenerCleanup) {
      this.wsListenerCleanup();
    }

    // 设置新的监听
    this.wsListenerCleanup = onMessage((data: any) => {
      if (data.type === 'friend_request') {
        this.handleWebSocketEvent(data as FriendRequestWebSocketEvent);
      }
    });

    logger.info('FriendRequestService', 'WebSocket friend request listener started');
  }

  /**
   * 停止 WebSocket 监听
   */
  stopWebSocketListener() {
    if (this.wsListenerCleanup) {
      this.wsListenerCleanup();
      this.wsListenerCleanup = null;
      logger.info('FriendRequestService', 'WebSocket friend request listener stopped');
    }
  }
}

// 导出单例
export const friendRequestService = new FriendRequestService();
export default friendRequestService;
