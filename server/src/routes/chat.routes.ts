import { Router } from 'express';
import chatController from '../controllers/chat.controller';
import messageController from '../controllers/message.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createChatSchema = z.object({
  body: z.object({
    participantIds: z.array(z.string()).min(1),
    name: z.string().optional(),
    type: z.enum(['direct', 'group']).optional(),
  }),
});

const sendMessageSchema = z.object({
  params: z.object({
    chatSessionId: z.string(),
  }),
  body: z.object({
    text: z.string().min(1),
    type: z.enum(['text', 'image', 'file']).optional(),
  }),
});

const updateMessageSchema = z.object({
  params: z.object({
    messageId: z.string(),
  }),
  body: z.object({
    text: z.string().min(1),
  }),
});

// Chat routes (protected)
router.use(authMiddleware);

// Chat session routes
router.post('/', validateRequest(createChatSchema), chatController.createChat);
router.get('/', chatController.getChats);
router.get('/:id', chatController.getChat);
router.put('/:id', chatController.updateChat);
router.delete('/:id', chatController.deleteChat);
router.post('/:id/read', chatController.markChatAsRead);

// Message routes
router.post('/:chatSessionId/messages', validateRequest(sendMessageSchema), messageController.sendMessage);
router.get('/:chatSessionId/messages', messageController.getMessages);
router.put('/messages/:messageId', validateRequest(updateMessageSchema), messageController.updateMessage);
router.delete('/messages/:messageId', messageController.deleteMessage);
router.post('/:chatSessionId/messages/read', messageController.markMessagesAsRead);

export default router;
