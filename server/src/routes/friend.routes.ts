import { Router } from 'express';
import friendController from '../controllers/friend.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const searchUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

const sendFriendRequestSchema = z.object({
  body: z.object({
    receiverId: z.string(),
    message: z.string().optional(),
  }),
});

// All routes are protected
router.use(authMiddleware);

// Search user by email
router.post(
  '/search',
  validateRequest(searchUserSchema),
  friendController.searchUser
);

// Send friend request
router.post(
  '/request',
  validateRequest(sendFriendRequestSchema),
  friendController.sendFriendRequest
);

// Get received friend requests
router.get(
  '/requests',
  friendController.getReceivedRequests
);

// Accept friend request
router.post(
  '/requests/:requestId/accept',
  friendController.acceptFriendRequest
);

// Reject friend request
router.post(
  '/requests/:requestId/reject',
  friendController.rejectFriendRequest
);

// Get friends list
router.get(
  '/list',
  friendController.getFriends
);

export default router;
