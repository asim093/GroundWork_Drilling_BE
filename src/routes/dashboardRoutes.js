import { Router } from 'express';
import { getDashboard, getAttention } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', authenticate, asyncHandler(getDashboard));
router.get('/attention', authenticate, asyncHandler(getAttention));

export default router;
