import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import jobRoutes from './jobRoutes.js';
import timeLogRoutes from './timeLogRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import bonusConfigRoutes from './bonusConfigRoutes.js';
import { makeMasterDataRouter } from './masterDataRoutes.js';
import { makeMasterDataController } from '../controllers/masterDataController.js';
import Location from '../models/Location.js';
import RigNumber from '../models/RigNumber.js';
import Consumable from '../models/Consumable.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/jobs', jobRoutes);
router.use('/time-logs', timeLogRoutes);
router.use('/locations', makeMasterDataRouter(makeMasterDataController(Location, { entityName: 'location' })));
router.use(
  '/rig-numbers',
  makeMasterDataRouter(makeMasterDataController(RigNumber, { entityName: 'rig number' }))
);
router.use(
  '/consumables',
  makeMasterDataRouter(makeMasterDataController(Consumable, { entityName: 'consumable' }))
);
router.use('/bonus-config', bonusConfigRoutes);

export default router;
