import { Router } from 'express';
import conversationsController from '../controllers/conversations.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All conversations routes are protected
router.use(authMiddleware);

// Get conversations with unread messages
router.get('/with-unread', conversationsController.getConversationsWithUnread);

// Get conversation info (for syncing when entering a chat)
router.get('/:conversationId/info', conversationsController.getConversationInfo);

// Update read status
router.post('/:conversationId/read', conversationsController.updateReadStatus);

export default router;
