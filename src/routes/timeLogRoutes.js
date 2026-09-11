import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  listTimeLogs,
  listMyTimeLogs,
  listScheduling,
  reportsHours,
  reportsConsumables,
  reportsFuel,
  reportsMine,
  reportsHoursExport,
  reportsConsumablesExport,
  reportsFuelExport,
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
const EXPORT_FORMATS = ['pdf', 'xlsx'];

const dateRangeValidators = [
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date')
];

const exportFormatValidator = query('format')
  .isIn(EXPORT_FORMATS)
  .withMessage('Format must be pdf or xlsx');

const reportFilterValidators = [
  query('job').optional().isMongoId().withMessage('Invalid job id'),
  query('user').optional().isMongoId().withMessage('Invalid user id'),
  query('employee').optional().isMongoId().withMessage('Invalid employee id'),
  query('client').optional().isString().trim()
];

const hoursScopeValidator = query('scope')
  .optional()
  .isIn(['client', 'employee', 'manager'])
  .withMessage('Scope must be client, employee or manager');

const NUMBER_FIELDS = ['hoursOnSite'];

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
  body('crew').optional().isArray().withMessage('Crew must be a list'),
  body('crew.*.employeeId').isMongoId().withMessage('Each crew member must be a valid employee'),
  body('crew.*.timeIn').optional({ nullable: true }).isString().withMessage('Crew time in must be a time value'),
  body('crew.*.timeOut').optional({ nullable: true }).isString().withMessage('Crew time out must be a time value'),
  ...NUMBER_FIELDS.map((field) =>
    body(field)
      .optional({ nullable: true })
      .isFloat({ min: 0 })
      .withMessage(`${field} must be a number`)
  ),
  body('activityLines').optional().isArray().withMessage('Activity lines must be a list'),
  body('activityLines.*.timeFrom')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time from must be a time value'),
  body('activityLines.*.timeTo')
    .optional({ nullable: true })
    .isString()
    .withMessage('Time to must be a time value'),
  body('activityLines.*.activityId')
    .optional({ nullable: true, checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid activity'),
  body('activityLines.*.comments').optional({ nullable: true }).isString().trim(),
  body('consumables').optional().isArray().withMessage('Consumables must be a list'),
  body('fuel').optional().isObject().withMessage('Fuel must be an object')
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
  query('shift').optional().isIn(['Day', 'Night']).withMessage('Shift must be Day or Night'),
  query('sort')
    .optional()
    .isIn(['scheduledDate', 'jobNumber', 'clientName'])
    .withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  validate,
  asyncHandler(listScheduling)
);

router.get(
  '/reports/hours',
  authorize('admin'),
  ...dateRangeValidators,
  ...reportFilterValidators,
  hoursScopeValidator,
  validate,
  asyncHandler(reportsHours)
);

router.get(
  '/reports/hours/export',
  authorize('admin'),
  ...dateRangeValidators,
  ...reportFilterValidators,
  hoursScopeValidator,
  exportFormatValidator,
  validate,
  asyncHandler(reportsHoursExport)
);

router.get(
  '/reports/consumables',
  authorize('admin'),
  ...dateRangeValidators,
  ...reportFilterValidators,
  validate,
  asyncHandler(reportsConsumables)
);

router.get(
  '/reports/consumables/export',
  authorize('admin'),
  ...dateRangeValidators,
  ...reportFilterValidators,
  exportFormatValidator,
  validate,
  asyncHandler(reportsConsumablesExport)
);

router.get(
  '/reports/fuel',
  authorize('admin'),
  ...dateRangeValidators,
  ...reportFilterValidators,
  validate,
  asyncHandler(reportsFuel)
);

router.get(
  '/reports/fuel/export',
  authorize('admin'),
  ...dateRangeValidators,
  ...reportFilterValidators,
  exportFormatValidator,
  validate,
  asyncHandler(reportsFuelExport)
);

router.get(
  '/reports/mine',
  authorize('operator'),
  ...dateRangeValidators,
  validate,
  asyncHandler(reportsMine)
);

router.post(
  '/',
  body('jobId').isMongoId().withMessage('A valid job id is required'),
  body('date').isISO8601().withMessage('Date is required and must be a valid date'),
  body('shift').isIn(['Day', 'Night']).withMessage('Shift is required and must be Day or Night'),
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
