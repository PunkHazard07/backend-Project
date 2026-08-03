import express from 'express';
const router = express.Router(); 
import * as controller from '../controllers/dashboardController';
import { adminAuth } from '../middleware/adminAuth';

//mount route
router.get('/dash-metrics', adminAuth, controller.getDashboardMetrics); 
router.get('/metrics/:metricType', adminAuth, controller.getSpecificMetric); 

export default router;