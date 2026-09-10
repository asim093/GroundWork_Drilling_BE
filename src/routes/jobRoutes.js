import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  listJobs,
  listAssignedJobs,
  getAssignedJob,
  getJob,
  createJob,
  updateJob,
  archiveJob,
  unarchiveJob
} from '../controllers/jobController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { SHIFTS } from '../config/masterData.js';

const STATUS_VALUES = ['scheduled', 'in-progress', 'submitted', 'archived'];
const SORT_FIELDS = ['scheduledDate', 'jobNumber', 'clientName', 'createdAt'];

const router = Router();

router.use(authenticate);

router.get(
  '/assigned',
  query('view').optional().isIn(['active', 'completed']).withMessage('Invalid view'),
  query('search').optional().trim(),
  query('rig').optional().isMongoId().withMessage('Invalid rig number'),
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date'),
  query('today')
    .optional()
    .isIn(['logged', 'draft', 'none'])
    .withMessage('Invalid today filter'),
  query('sort').optional().isIn(SORT_FIELDS).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  validate,
  asyncHandler(listAssignedJobs)
);

router.get(
  '/assigned/:id',
  param('id').isMongoId().withMessage('Invalid job id'),
  validate,
  asyncHandler(getAssignedJob)
);

router.use(authorize('admin'));

router.get(
  '/',
  query('status').optional().isIn(STATUS_VALUES).withMessage('Invalid status filter'),
  query('view')
    .optional()
    .isIn(['active', 'submitted', 'archived'])
    .withMessage('Invalid view'),
  query('assignedUser').optional().isMongoId().withMessage('Invalid user id'),
  query('rigNumber').optional().isMongoId().withMessage('Invalid rig number'),
  query('search').optional().trim(),
  query('from').optional().isISO8601().withMessage('From must be a valid date'),
  query('to').optional().isISO8601().withMessage('To must be a valid date'),
  query('sort').optional().isIn(SORT_FIELDS).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  validate,
  asyncHandler(listJobs)
);

router.post(
  '/',
  body('jobNumber').trim().notEmpty().withMessage('Job number is required'),
  body('clientName').trim().notEmpty().withMessage('Client name is required'),
  body('jobLocation').optional().trim(),
  body('clientJobNumber').optional().trim(),
  body('drillNumber').optional({ nullable: true }).trim(),
  body('rigNumber').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid rig number'),
  body('scheduledDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('status').optional().isIn(STATUS_VALUES).withMessage('Invalid status'),
  body('assignedUserIds').optional().isArray().withMessage('assignedUserIds must be an array'),
  body('assignedUserIds.*').isMongoId().withMessage('Each operator id must be valid'),
  body('siteManagers').optional().isArray().withMessage('siteManagers must be an array'),
  body('siteManagers.*.userId').isMongoId().withMessage('Each site manager id must be valid'),
  body('siteManagers.*.shift').isIn(SHIFTS).withMessage('Each site manager needs a valid shift'),
  body('rosterEmployeeIds').optional().isArray().withMessage('rosterEmployeeIds must be an array'),
  body('rosterEmployeeIds.*').isMongoId().withMessage('Each employee id must be valid'),
  validate,
  asyncHandler(createJob)
);

router.get(
  '/:id',
  param('id').isMongoId().withMessage('Invalid job id'),
  validate,
  asyncHandler(getJob)
);

router.patch(
  '/:id',
  param('id').isMongoId().withMessage('Invalid job id'),
  body('jobNumber').optional().trim().notEmpty().withMessage('Job number cannot be empty'),
  body('clientName').optional().trim().notEmpty().withMessage('Client name cannot be empty'),
  body('jobLocation').optional({ nullable: true }).trim(),
  body('clientJobNumber').optional({ nullable: true }).trim(),
  body('drillNumber').optional({ nullable: true }).trim(),
  body('rigNumber').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Invalid rig number'),
  body('scheduledDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Scheduled date must be a valid date'),
  body('status').optional().isIn(STATUS_VALUES).withMessage('Invalid status'),
  body('assignedUserIds').optional().isArray().withMessage('assignedUserIds must be an array'),
  body('assignedUserIds.*').isMongoId().withMessage('Each operator id must be valid'),
  body('siteManagers').optional().isArray().withMessage('siteManagers must be an array'),
  body('siteManagers.*.userId').isMongoId().withMessage('Each site manager id must be valid'),
  body('siteManagers.*.shift').isIn(SHIFTS).withMessage('Each site manager needs a valid shift'),
  body('rosterEmployeeIds').optional().isArray().withMessage('rosterEmployeeIds must be an array'),
  body('rosterEmployeeIds.*').isMongoId().withMessage('Each employee id must be valid'),
  validate,
  asyncHandler(updateJob)
);

router.post(
  '/:id/archive',
  param('id').isMongoId().withMessage('Invalid job id'),
  validate,
  asyncHandler(archiveJob)
);

router.post(
  '/:id/unarchive',
  param('id').isMongoId().withMessage('Invalid job id'),
  validate,
  asyncHandler(unarchiveJob)
);

export default router;
