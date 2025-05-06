const express = require('express'); // Import express
const cartController = require('../controllers/cartController'); // Import the cartController
const authMiddleware = require('../middleware/auth'); // Import the authentication middleware

const router = express.Router(); // Create an instance of the express router

// Mounting the cart routes
router.get('/cart/items', authMiddleware.auth, cartController.getCart); 
// Route to get the cart for the logged-in user (protected by auth middleware)

router.post('/cart/add/', authMiddleware.auth, cartController.addItemToCart); 
// Route to add an item to the cart (protected by auth middleware)

router.post('/cart/remove', authMiddleware.auth, cartController.removeItemFromCart); 
// Route to remove an item from the cart (protected by auth middleware)

router.post('/cart/increase', authMiddleware.auth, cartController.increaseItemQuantity);
// Route to increase the quantity of an item in the cart (protected by auth middleware)

router.post('/cart/decrease', authMiddleware.auth, cartController.decreaseItemQuantity);
// Route to decrease the quantity of an item in the cart (protected by auth middleware)

router.delete('/cart/clear', authMiddleware.auth, cartController.clearCart); 
// Route to clear all items from the cart (protected by auth middleware)

router.post('/cart/merge', authMiddleware.auth, cartController.mergeCart);
// Route to merge the cart with another user's cart (protected by auth middleware)

module.exports = router; // Export the router to be used in the main app
