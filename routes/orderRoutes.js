const express = require('express'); // Import express
const router = express.Router(); // Create an instance of the express router


//  Import the order controller
const {paymentOnCash, allOrders, userOrders, updateOrderStatus, deleteOrder, archiveOrder, getOrderById} = require('../controllers/orderController.js');
const { adminAuth } = require('../middleware/adminAuth.js'); // middleware to protect routes for admin
const { auth } = require('../middleware/auth.js');

//  Mounting the order routes
//  admin routes/features
router.post('/listOrders', adminAuth ,allOrders); // Route to list all orders in the admin panel
router.post('/status', adminAuth ,updateOrderStatus); // Route to update order status in the admin panel
router.post('/deleteOrder', adminAuth ,deleteOrder); // Route to delete an order in the admin panel
router.post('/archiveOrder', adminAuth ,archiveOrder); // Route to archive an order in the admin panel

// //payment routes/features   
router.post('/place', auth, paymentOnCash); // Route to place an order using cash on delivery 

// //user feature routes
router.get('/userOrders', auth ,userOrders); // Route to get all orders for a user

router.get('/orders/:id', auth ,getOrderById); // Route to get a specific order by ID for a user


// Export the router
module.exports = router; // Export the router

