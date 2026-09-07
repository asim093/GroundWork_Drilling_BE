import { Router } from 'express';
import { body } from 'express-validator';
import { getBonusConfig, updateBonusConfig } from '../controllers/bonusConfigController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/', asyncHandler(getBonusConfig));

router.patch(
  '/',
  body('recoveryThreshold')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Recovery threshold must be between 0 and 100'),
  body('tierTables').optional().isArray().withMessage('Tier tables must be a list'),
  body('tierTables.*.employeeType').optional().isString(),
  body('tierTables.*.bands').optional().isArray(),
  body('tierTables.*.bands.*.fromMeters').optional().isFloat({ min: 0 }),
  body('tierTables.*.bands.*.toMeters').optional().isFloat({ min: 0 }),
  body('tierTables.*.bands.*.rateType').optional().isIn(['flat', 'perMeter']),
  body('tierTables.*.bands.*.value').optional().isFloat({ min: 0 }),
  validate,
  asyncHandler(updateBonusConfig)
);

export default router;
