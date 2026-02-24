import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import friendService from '../services/friend.service';
import logger from '../utils/logger';

class FriendController {
  /**
   * 搜索用户
   */
  async searchUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: 'Email is required',
        });
        return;
      }

      const user = await friendService.searchUserByEmail(email);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error: any) {
      logger.error('Search user controller error:', error);
      next(error);
    }
  }

  /**
   * 发送好友请求
   */
  async sendFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const senderId = req.user!.id;
      const { receiverId, message } = req.body;

      if (!receiverId) {
        res.status(400).json({
          success: false,
          error: 'Receiver ID is required',
        });
        return;
      }

      if (receiverId === senderId) {
        res.status(400).json({
          success: false,
          error: 'Cannot add yourself as a friend',
        });
        return;
      }

      const request = await friendService.sendFriendRequest(senderId, receiverId, message);

      res.status(201).json({
        success: true,
        data: { request },
        message: 'Friend request sent successfully',
      });
    } catch (error: any) {
      logger.error('Send friend request controller error:', error);
      next(error);
    }
  }

  /**
   * 获取收到的好友请求
   */
  async getReceivedRequests(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const requests = await friendService.getReceivedRequests(userId);

      res.status(200).json({
        success: true,
        data: { requests },
      });
    } catch (error: any) {
      logger.error('Get received requests controller error:', error);
      next(error);
    }
  }

  /**
   * 同意好友请求
   */
  async acceptFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { requestId } = req.params;

      const result = await friendService.acceptFriendRequest(requestId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Friend request accepted',
      });
    } catch (error: any) {
      logger.error('Accept friend request controller error:', error);
      next(error);
    }
  }

  /**
   * 拒绝好友请求
   */
  async rejectFriendRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { requestId } = req.params;

      const result = await friendService.rejectFriendRequest(requestId, userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Friend request rejected',
      });
    } catch (error: any) {
      logger.error('Reject friend request controller error:', error);
      next(error);
    }
  }

  /**
   * 获取好友列表
   */
  async getFriends(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const friends = await friendService.getFriends(userId);

      res.status(200).json({
        success: true,
        data: { friends },
      });
    } catch (error: any) {
      logger.error('Get friends controller error:', error);
      next(error);
    }
  }
}

export default new FriendController();
