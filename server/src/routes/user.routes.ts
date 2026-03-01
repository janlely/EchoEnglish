import { Router } from 'express';
import userController from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// Get user profile
router.get('/profile', userController.getProfile);

// Get user by ID
router.get('/:userId', userController.getUserById);

// Get users by IDs (batch)
router.post('/batch', userController.getUsersByIds);

// Upload avatar (supports multipart/form-data and JSON with base64)
router.post('/avatar', uploadMiddleware, userController.uploadAvatar);

export default router;
