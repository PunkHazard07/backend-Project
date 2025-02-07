const express = require('express'); // Import express
const router = express.Router(); // Create an instance of the express router


// Import the order controller
const {placeOrder, placeOrderPaystack, placeOrderFlutterwave, allOrders, userOrders, updateOrderStatus} = require('../controllers/orderController.js');
const { adminAuth } = require('../middleware/adminAuth.js'); // middleware to protect routes for admin
const { auth } = require('../middleware/auth.js');

// Mounting the order routes
//admin routes/features
router.post('/listOrders', adminAuth ,allOrders); // Route to list all orders in the admin panel
router.post('/status', adminAuth ,updateOrderStatus); // Route to update order status in the admin panel

//payment routes/features   
router.post('/place', auth ,placeOrder); // Route to place an order using cash on delivery
//I add the auth middleware on the placeorder to fetch the id of the user paying on cash 

// router.post('/paystack', auth ,placeOrderPaystack); // Route to place an order using paystack

router.post('/flutterwave', auth ,placeOrderFlutterwave); // Route to place an order using flutterwave

//user feature routes
router.post('/userOrders', auth ,userOrders); // Route to get all orders for a user


// Export the router
module.exports = router; // Export the router

