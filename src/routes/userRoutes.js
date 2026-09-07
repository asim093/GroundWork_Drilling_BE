import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { listUsers, getUser, createUser, updateUser } from '../controllers/userController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get(
  '/',
  query('role').optional().isIn(['admin', 'operator']).withMessage('Role must be admin or operator'),
  query('active').optional().isIn(['true', 'false']).withMessage('Active must be true or false'),
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
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['admin', 'operator']).withMessage('Role must be admin or operator'),
  body('phone').optional().trim(),
  validate,
  asyncHandler(createUser)
);

router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid user id'),
  validate,
  asyncHandler(getUser)
);

router.patch(
  '/:id',
  param('id').isMongoId().withMessage('Invalid user id'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('A valid email is required'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role').optional().isIn(['admin', 'operator']).withMessage('Role must be admin or operator'),
  body('active').optional().isBoolean().withMessage('Active must be true or false'),
  body('phone').optional({ nullable: true }).trim(),
  validate,
  asyncHandler(updateUser)
);

export default router;
