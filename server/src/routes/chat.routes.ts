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
    conversationId: z.string(),
  }),
  body: z.object({
    text: z.string().min(1),
    type: z.enum(['text', 'image', 'file']).optional(),
    msgId: z.string().optional(),
    chatType: z.enum(['direct', 'group']).optional(),
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

const getMessagesSchema = z.object({
  params: z.object({
    conversationId: z.string(),
  }),
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    chatType: z.string().optional(),
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

// Message routes (using conversationId)
router.post('/conversations/:conversationId/messages', validateRequest(sendMessageSchema), messageController.sendMessage);
router.get('/conversations/:conversationId/messages', validateRequest(getMessagesSchema), messageController.getMessages);
router.put('/messages/:messageId', validateRequest(updateMessageSchema), messageController.updateMessage);
router.delete('/messages/:messageId', messageController.deleteMessage);
router.post('/conversations/:conversationId/messages/read', messageController.markMessagesAsRead);

// Message sync routes (using conversationId in query params)
router.get('/sessions/sync', messageController.syncSessions);
router.get('/messages/sync', messageController.syncMessages);
router.get('/messages/history', messageController.syncHistoryMessages);
router.post('/messages/ack', messageController.ackMessages);

// New conversation routes
router.get('/conversations/with-unread', messageController.getConversationsWithUnread);
router.get('/conversations/direct/:otherUserId', messageController.getOrCreateDirectConversation);

export default router;
