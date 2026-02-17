import { Router } from 'express';
import authRoutes from './auth.routes';
import chatRoutes from './chat.routes';
import notificationRoutes from './notification.routes';
import emailVerificationRoutes from './emailVerification.routes';

const router = Router();

// API routes
router.use('/auth', authRoutes);
router.use('/chats', chatRoutes);
router.use('/notifications', notificationRoutes);
router.use('/email-verification', emailVerificationRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
