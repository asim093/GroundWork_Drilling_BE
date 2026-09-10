import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  listTimeLogs,
  listMyTimeLogs,
  listScheduling,
  reportsSummary,
  reportsMine,
  reportsSummaryExport,
  reportsMineExport,
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
const EXPORT_FORMATS = ['pdf', 'xlsx'];

const dateRangeValidators = [
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date')
];

const exportFormatValidator = query('format')
  .isIn(EXPORT_FORMATS)
  .withMessage('Format must be pdf or xlsx');

const chartBodyValidators = [
  body('charts').optional().isArray().withMessage('Charts must be a list'),
  body('charts.*.title').optional().isString().withMessage('Chart title must be text'),
  body('charts.*.dataUrl')
    .optional()
    .isString()
    .withMessage('Chart image must be a data URL')
    .bail()
    .matches(/^data:image\/png;base64,/)
    .withMessage('Chart image must be a PNG data URL')
];

const NUMBER_FIELDS = [
  'hoursOnSite',
  'standbyHours',
  'otherHours',
  'mileageStart',
  'mileageEnd'
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
  body('activityLines.*.depthFrom')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Depth from must be a number'),
  body('activityLines.*.depthTo')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Depth to must be a number')
    .bail()
    .custom((value, { req, pathValues }) => {
      const line = req.body.activityLines?.[pathValues[0]] || {};
      const from = line.depthFrom;
      if (from !== null && from !== undefined && from !== '' && Number(value) < Number(from)) {
        throw new Error('Depth to cannot be less than depth from');
      }
      return true;
    }),
  body('activityLines.*.recoveryMeters')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Recovery meters must be a number')
    .bail()
    .custom((value, { req, pathValues }) => {
      const line = req.body.activityLines?.[pathValues[0]] || {};
      const { depthFrom, depthTo } = line;
      const hasRange =
        depthFrom !== null &&
        depthFrom !== undefined &&
        depthFrom !== '' &&
        depthTo !== null &&
        depthTo !== undefined &&
        depthTo !== '';
      if (hasRange && Number(value) > Number(depthTo) - Number(depthFrom)) {
        throw new Error('Recovery meters cannot exceed drilled meters for the run');
      }
      return true;
    }),
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
  ...dateRangeValidators,
  query('groupBy').optional().isIn(['user', 'job']).withMessage('groupBy must be user or job'),
  query('user').optional().isMongoId().withMessage('Invalid user id'),
  validate,
  asyncHandler(reportsSummary)
);

router.get(
  '/reports/summary/export',
  authorize('admin'),
  ...dateRangeValidators,
  query('groupBy').optional().isIn(['user', 'job']).withMessage('groupBy must be user or job'),
  query('user').optional().isMongoId().withMessage('Invalid user id'),
  exportFormatValidator,
  validate,
  asyncHandler(reportsSummaryExport)
);

router.post(
  '/reports/summary/export',
  authorize('admin'),
  ...dateRangeValidators,
  query('groupBy').optional().isIn(['user', 'job']).withMessage('groupBy must be user or job'),
  query('user').optional().isMongoId().withMessage('Invalid user id'),
  exportFormatValidator,
  ...chartBodyValidators,
  validate,
  asyncHandler(reportsSummaryExport)
);

router.get(
  '/reports/mine',
  authorize('operator'),
  ...dateRangeValidators,
  validate,
  asyncHandler(reportsMine)
);

router.get(
  '/reports/mine/export',
  authorize('operator'),
  ...dateRangeValidators,
  exportFormatValidator,
  validate,
  asyncHandler(reportsMineExport)
);

router.post(
  '/reports/mine/export',
  authorize('operator'),
  ...dateRangeValidators,
  exportFormatValidator,
  ...chartBodyValidators,
  validate,
  asyncHandler(reportsMineExport)
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
