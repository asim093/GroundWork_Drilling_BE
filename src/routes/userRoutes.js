import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  resendInvite
} from '../controllers/userController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get(
  '/',
  query('active').optional().isIn(['true', 'false']).withMessage('Active must be true or false'),
  query('status')
    .optional()
    .isIn(['pending', 'active'])
    .withMessage('Status must be pending or active'),
  query('sort')
    .optional()
    .isIn(['name', 'email', 'createdAt'])
    .withMessage('Sort must be name, email or createdAt'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  validate,
  asyncHandler(listUsers)
);

router.post(
  '/',
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('phone').optional().trim(),
  validate,
  asyncHandler(createUser)
);

router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid operator id'),
  validate,
  asyncHandler(getUser)
);

router.patch(
  '/:id',
  param('id').isMongoId().withMessage('Invalid operator id'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('A valid email is required'),
  body('active').optional().isBoolean().withMessage('Active must be true or false'),
  body('phone').optional({ nullable: true }).trim(),
  validate,
  asyncHandler(updateUser)
);

router.post(
  '/:id/resend-invite',
  param('id').isMongoId().withMessage('Invalid operator id'),
  validate,
  asyncHandler(resendInvite)
);

export default router;
