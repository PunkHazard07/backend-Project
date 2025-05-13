const express = require('express'); // Import express
const router = express.Router(); // Create an instance of the express router

const { auth, checkVerified } = require('../middleware/auth.js');

const { paymentOnCash, paystackInit, verifyPaystackTransaction } = require('../controllers/paymentController.js'); // Import the payment controller


router.post('/place', auth,checkVerified ,paymentOnCash); // Route to place an order using cash on delivery

router.post('/paystack/init', auth, checkVerified, paystackInit);
router.get('/paystack/verify/:reference/:orderId', auth, checkVerified, verifyPaystackTransaction); // Route to verify Paystack transaction

module.exports = router; 