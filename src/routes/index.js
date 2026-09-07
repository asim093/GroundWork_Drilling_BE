import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

export default router;
