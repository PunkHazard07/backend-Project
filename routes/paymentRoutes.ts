import express from 'express';
import { auth, checkVerified } from '../middleware/auth';
import * as controller from '../controllers/paymentController';
const router = express.Router(); // Create an instance of the express router

router.post('/paystack/init', auth, checkVerified, controller.paystackInit);
router.get('/paystack/verify/:reference/:orderId', auth, checkVerified, controller.verifyPaystackTransaction);
router.post('/paystack/webhook', controller.paystackWebhook); // TODO: In paystack dashboard set the webhook URL

export default router;