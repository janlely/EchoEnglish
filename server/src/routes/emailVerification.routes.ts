import { Router } from 'express';
import emailVerificationController from '../controllers/emailVerification.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

// Validation schemas
const sendCodeSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    code: z.string().length(6, 'Code must be 6 digits'),
  }),
});

const resendSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    hcaptcha_token: z.string(),
  }),
});

// Routes
router.post(
  '/send-code',
  authMiddleware,
  validateRequest(sendCodeSchema),
  emailVerificationController.sendVerificationCode
);

router.post(
  '/verify',
  validateRequest(verifyEmailSchema),
  emailVerificationController.verifyEmail
);

router.get(
  '/check',
  authMiddleware,
  emailVerificationController.checkVerificationStatus
);

router.post(
  '/resend',
  validateRequest(resendSchema),
  emailVerificationController.resendCode
);

export default router;
