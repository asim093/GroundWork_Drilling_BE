import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  listTimeLogs,
  listMyTimeLogs,
  listScheduling,
  reportsSummary,
  reportsMonthlyComparison,
  getTimeLog,
  createTimeLog,
  updateTimeLog,
  submitTimeLog
} from '../controllers/timeLogController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const STATUS_VALUES = ['draft', 'submitted'];
const SORT_FIELDS = ['date', 'createdAt', 'updatedAt', 'status'];

const NUMBER_FIELDS = [
  'hoursOnSite',
  'standbyHours',
  'otherHours',
  'mileageStart',
  'mileageEnd',
  'mileageTotal',
  'metersDrilled',
  'metersRecovered'
];

const listValidators = [
  query('status').optional().isIn(STATUS_VALUES).withMessage('Status must be draft or submitted'),
  query('job').optional().isMongoId().withMessage('Invalid job id'),
  query('user').optional().isMongoId().withMessage('Invalid user id'),
  query('date').optional().isISO8601().withMessage('Date must be a valid date'),
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date'),
  query('sort').optional().isIn(SORT_FIELDS).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
];

const entryBodyValidators = [
  body('date').optional().isISO8601().withMessage('Date must be a valid date'),
  body('shift')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['Day', 'Night'])
    .withMessage('Shift must be Day or Night'),
  ...NUMBER_FIELDS.map((field) =>
    body(field)
      .optional({ nullable: true })
      .isFloat({ min: 0 })
      .withMessage(`${field} must be a number`)
  ),
  body('activityLines').optional().isArray().withMessage('Activity lines must be a list'),
  body('consumables').optional().isArray().withMessage('Consumables must be a list'),
  body('fuel').optional().isObject().withMessage('Fuel must be an object'),
  body('wellTag').optional().isObject().withMessage('Well tag must be an object')
];

const router = Router();

router.use(authenticate);

router.get('/', authorize('admin'), ...listValidators, validate, asyncHandler(listTimeLogs));

router.get('/mine', ...listValidators, validate, asyncHandler(listMyTimeLogs));

router.get(
  '/scheduling',
  authorize('admin'),
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date'),
  query('job').optional().isMongoId().withMessage('Invalid job id'),
  query('status')
    .optional()
    .isIn(['submitted', 'draft', 'missing'])
    .withMessage('Status must be submitted, draft or missing'),
  query('sort')
    .optional()
    .isIn(['scheduledDate', 'jobNumber', 'clientName'])
    .withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  validate,
  asyncHandler(listScheduling)
);

router.get(
  '/reports/summary',
  authorize('admin'),
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date'),
  query('groupBy').optional().isIn(['user', 'job']).withMessage('groupBy must be user or job'),
  validate,
  asyncHandler(reportsSummary)
);

router.get(
  '/reports/monthly-comparison',
  authorize('admin'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2000, max: 2100 }).withMessage('Year must be a valid year'),
  validate,
  asyncHandler(reportsMonthlyComparison)
);

router.post(
  '/',
  body('jobId').isMongoId().withMessage('A valid job id is required'),
  body('date').isISO8601().withMessage('Date is required and must be a valid date'),
  ...entryBodyValidators,
  validate,
  asyncHandler(createTimeLog)
);

router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid time log id'),
  validate,
  asyncHandler(getTimeLog)
);

router.patch(
  '/:id',
  param('id').isMongoId().withMessage('Invalid time log id'),
  ...entryBodyValidators,
  validate,
  asyncHandler(updateTimeLog)
);

router.post(
  '/:id/submit',
  param('id').isMongoId().withMessage('Invalid time log id'),
  validate,
  asyncHandler(submitTimeLog)
);

export default router;
