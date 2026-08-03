import express from 'express';
import * as controller from '../controllers/cartController'
import { auth, checkVerified } from '../middleware/auth';

const router = express.Router(); 

// Mounting the cart routes
router.get('/cart/items', auth, checkVerified, controller.getCart); 
router.post('/cart/add/', auth, checkVerified, controller.addItemToCart); 
router.post('/cart/remove', auth, checkVerified, controller.removeItemFromCart);
router.patch('/cart/quantity', auth, checkVerified, controller.updateItemQuantity);
router.delete('/cart/clear', auth, checkVerified, controller.clearCart); 
router.post('/cart/merge', auth, checkVerified, controller.mergeCart);

export default router;