import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import jobRoutes from './jobRoutes.js';
import timeLogRoutes from './timeLogRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/jobs', jobRoutes);
router.use('/time-logs', timeLogRoutes);

export default router;
