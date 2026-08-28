import express from 'express';
const router = express.Router(); 

//  Import the order controller
import * as controller from "../controllers/orderController"
import { adminAuth } from '../middleware/adminAuth';
import { auth, checkVerified } from '../middleware/auth';

//  admin routes/features
router.post('/list-orders', adminAuth, controller.allOrders);
router.post('/status', adminAuth, controller.updateOrderStatus); 
router.post('/delete-order', adminAuth, controller.deleteOrder); 
router.post('/archive-order', adminAuth, controller.archiveOrder); 

//user feature routes
router.get('/user-orders', auth, checkVerified, controller.userOrders); 
router.get('/orders/:id', auth, checkVerified, controller.getOrderById); 

export default router;