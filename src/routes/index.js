import { Router } from 'express';
import { body } from 'express-validator';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import jobRoutes from './jobRoutes.js';
import timeLogRoutes from './timeLogRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import bonusConfigRoutes from './bonusConfigRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import { makeMasterDataRouter } from './masterDataRoutes.js';
import { makeMasterDataController } from '../controllers/masterDataController.js';
import Location from '../models/Location.js';
import RigNumber from '../models/RigNumber.js';
import Consumable from '../models/Consumable.js';
import ActivityCategory from '../models/ActivityCategory.js';
import Activity from '../models/Activity.js';
import Employee from '../models/Employee.js';
import { EMPLOYEE_TYPES } from '../config/masterData.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/jobs', jobRoutes);
router.use('/time-logs', timeLogRoutes);
router.use('/catalog', catalogRoutes);
router.use('/locations', makeMasterDataRouter(makeMasterDataController(Location, { entityName: 'location' })));
router.use(
  '/rig-numbers',
  makeMasterDataRouter(makeMasterDataController(RigNumber, { entityName: 'rig number' }))
);
router.use(
  '/consumables',
  makeMasterDataRouter(
    makeMasterDataController(Consumable, {
      entityName: 'consumable',
      fields: [{ name: 'group', kind: 'string', filterParam: 'group', distinct: true }]
    }),
    {
      createValidators: [body('group').optional({ nullable: true }).trim()],
      updateValidators: [body('group').optional({ nullable: true }).trim()]
    }
  )
);
router.use(
  '/activity-categories',
  makeMasterDataRouter(makeMasterDataController(ActivityCategory, { entityName: 'activity category' }))
);
router.use(
  '/activities',
  makeMasterDataRouter(
    makeMasterDataController(Activity, {
      entityName: 'activity',
      fields: [
        {
          name: 'categoryId',
          kind: 'ref',
          ref: ActivityCategory,
          filterParam: 'category',
          label: 'Category',
          required: true
        }
      ]
    }),
    {
      createValidators: [
        body('categoryId')
          .notEmpty()
          .withMessage('Category is required')
          .bail()
          .isMongoId()
          .withMessage('Invalid category')
      ],
      updateValidators: [
        body('categoryId').optional().isMongoId().withMessage('Invalid category')
      ]
    }
  )
);
router.use(
  '/employees',
  makeMasterDataRouter(
    makeMasterDataController(Employee, {
      entityName: 'employee',
      fields: [
        { name: 'employeeType', kind: 'string', filterParam: 'employeeType' },
        { name: 'employeeCategory', kind: 'string', filterParam: 'employeeCategory' }
      ]
    }),
    {
      createValidators: [
        body('employeeType')
          .trim()
          .notEmpty()
          .withMessage('Employee type is required')
          .bail()
          .isIn(EMPLOYEE_TYPES)
          .withMessage('Invalid employee type'),
        body('employeeCategory').optional({ nullable: true }).trim()
      ],
      updateValidators: [
        body('employeeType').optional().isIn(EMPLOYEE_TYPES).withMessage('Invalid employee type'),
        body('employeeCategory').optional({ nullable: true }).trim()
      ]
    }
  )
);
router.use('/bonus-config', bonusConfigRoutes);

export default router;
