import { Router } from 'express';
import assistantController from '../controllers/assistant.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const analyzeSchema = z.object({
  body: z.object({
    input: z.string().min(1, 'Input is required'),
    conversationId: z.string().min(1, 'Conversation ID is required'),
  }),
});

// Validation schema for GET requests
const analyzeGetSchema = z.object({
  query: z.object({
    input: z.string().min(1, 'Input is required'),
    conversationId: z.string().min(1, 'Conversation ID is required'),
  }),
});

// Validation schema for SSE test
const sseTestSchema = z.object({
  query: z.object({
    input: z.string().min(1, 'Input is required'),
    conversationId: z.string().min(1, 'Conversation ID is required'),
  }),
});

// All routes require authentication
router.use(authMiddleware);

// Analyze endpoint with streaming (SSE) - POST version
router.post('/analyze', validateRequest(analyzeSchema), assistantController.analyze);

// Analyze endpoint with streaming (SSE) - GET version
router.get('/analyze', validateRequest(analyzeGetSchema), assistantController.analyzeGet);

// SSE test endpoint
router.get('/sse-test', validateRequest(sseTestSchema), assistantController.testSSE);

// Simple analyze endpoint (for testing, no streaming)
router.post('/analyze-simple', validateRequest(analyzeSchema), assistantController.analyzeSimple);

export default router;