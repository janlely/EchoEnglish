import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import contactService from '../services/contact.service';
import groupAvatarService from '../services/groupAvatar.service';
import logger from '../utils/logger';

class ContactController {
  /**
   * 增量同步联系人
   */
  async syncContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { friendCursor, groupCursor, requestCursor } = req.query;

      const cursor = await contactService.getSyncCursor(userId);
      const friendC = friendCursor ? BigInt(friendCursor as string) : cursor.friendCursor;
      const groupC = groupCursor ? BigInt(groupCursor as string) : cursor.groupCursor;
      const requestC = requestCursor ? BigInt(requestCursor as string) : cursor.requestCursor;

      const result = await contactService.syncContacts(userId, friendC, groupC, requestC);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Sync contacts controller error:', error);
      next(error);
    }
  }

  /**
   * 获取好友列表
   */
  async getFriends(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const friends = await contactService.getFriends(userId);

      res.status(200).json({
        success: true,
        data: { friends },
      });
    } catch (error: any) {
      logger.error('Get friends controller error:', error);
      next(error);
    }
  }

  /**
   * 获取群组列表
   */
  async getGroups(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const groups = await contactService.getGroups(userId);

      res.status(200).json({
        success: true,
        data: { groups },
      });
    } catch (error: any) {
      logger.error('Get groups controller error:', error);
      next(error);
    }
  }

  /**
   * 获取单个群信息
   */
  async getGroup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { groupId } = req.params;

      const group = await contactService.getGroup(userId, groupId);

      res.status(200).json({
        success: true,
        data: { group },
      });
    } catch (error: any) {
      logger.error('Get group controller error:', error);
      next(error);
    }
  }

  /**
   * 创建群组
   */
  async createGroup(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { name, avatarUrl, memberIds } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Group name is required',
        });
        return;
      }

      const group = await contactService.createGroup(userId, name, avatarUrl, memberIds);

      // Generate group avatar automatically after group creation
      // Run in background, don't wait for completion
      groupAvatarService.generateGroupAvatar(group.id).catch(err => {
        logger.error('[ContactController] Generate group avatar error:', err);
      });

      res.status(201).json({
        success: true,
        data: { group },
        message: 'Group created successfully',
      });
    } catch (error: any) {
      logger.error('Create group controller error:', error);
      next(error);
    }
  }

  /**
   * 添加群成员
   */
  async addGroupMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { groupId } = req.params;
      const { memberId } = req.body;

      if (!groupId || !memberId) {
        res.status(400).json({
          success: false,
          error: 'Group ID and member ID are required',
        });
        return;
      }

      const result = await contactService.addGroupMember(groupId, memberId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Member added successfully',
      });
    } catch (error: any) {
      logger.error('Add group member controller error:', error);
      next(error);
    }
  }

  /**
   * 移除群成员
   */
  async removeGroupMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { groupId } = req.params;
      const { memberId } = req.body;

      if (!groupId || !memberId) {
        res.status(400).json({
          success: false,
          error: 'Group ID and member ID are required',
        });
        return;
      }

      const result = await contactService.removeGroupMember(groupId, memberId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Member removed successfully',
      });
    } catch (error: any) {
      logger.error('Remove group member controller error:', error);
      next(error);
    }
  }

  /**
   * 更新群组名称
   */
  async updateGroupName(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { groupId } = req.params;
      const { name } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Group name is required',
        });
        return;
      }

      const updatedGroup = await contactService.updateGroupName(groupId, name, userId);

      res.status(200).json({
        success: true,
        data: { group: updatedGroup },
        message: 'Group name updated successfully',
      });
    } catch (error: any) {
      logger.error('Update group name controller error:', error);
      next(error);
    }
  }
}

export default new ContactController();
