import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const makeMasterDataRouter = (controller) => {
  const router = Router();

  router.use(authenticate, authorize('admin'));

  router.get(
    '/',
    query('active').optional().isIn(['true', 'false']).withMessage('Active must be true or false'),
    query('search').optional().trim(),
    query('sort').optional().isIn(['name', 'createdAt']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
    validate,
    asyncHandler(controller.list)
  );

  router.post(
    '/',
    body('name').trim().notEmpty().withMessage('Name is required'),
    validate,
    asyncHandler(controller.create)
  );

  router.patch(
    '/:id',
    param('id').isMongoId().withMessage('Invalid id'),
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('active').optional().isBoolean().withMessage('Active must be true or false'),
    validate,
    asyncHandler(controller.update)
  );

  router.delete(
    '/:id',
    param('id').isMongoId().withMessage('Invalid id'),
    validate,
    asyncHandler(controller.remove)
  );

  return router;
};
