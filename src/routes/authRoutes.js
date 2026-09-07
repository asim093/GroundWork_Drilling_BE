import { Router } from 'express';
import { body } from 'express-validator';
import { login, getCurrentUser } from '../controllers/authController.js';
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

export default router;
