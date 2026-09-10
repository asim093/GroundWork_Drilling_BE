import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listCatalogActivities,
  listCatalogConsumables
} from '../controllers/catalogController.js';

const router = Router();

router.use(authenticate);

router.get('/activities', asyncHandler(listCatalogActivities));
router.get('/consumables', asyncHandler(listCatalogConsumables));

export default router;
