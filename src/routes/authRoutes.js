import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  login,
  getCurrentUser,
  getInvite,
  acceptInvite,
  changePassword
} from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post(
  '/login',
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  asyncHandler(login)
);

router.get('/me', authenticate, asyncHandler(getCurrentUser));

router.get(
  '/invite',
  query('token').notEmpty().withMessage('An invitation token is required'),
  validate,
  asyncHandler(getInvite)
);

router.post(
  '/accept-invite',
  body('token').notEmpty().withMessage('An invitation token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate,
  asyncHandler(acceptInvite)
);

router.post(
  '/change-password',
  authenticate,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  validate,
  asyncHandler(changePassword)
);

export default router;
