import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import contactService from '../services/contact.service';
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
}

export default new ContactController();
