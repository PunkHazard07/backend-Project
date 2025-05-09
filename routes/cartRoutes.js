const express = require('express'); // Import express
const cartController = require('../controllers/cartController'); // Import the cartController
const {auth, checkVerified} = require('../middleware/auth.js') // Import the authentication middleware

const router = express.Router(); // Create an instance of the express router

// Mounting the cart routes
router.get('/cart/items', auth, checkVerified, cartController.getCart); 
// Route to get the cart for the logged-in user (protected by auth middleware)

router.post('/cart/add/', auth, checkVerified, cartController.addItemToCart); 
// Route to add an item to the cart (protected by auth middleware)

router.post('/cart/remove', auth, checkVerified, cartController.removeItemFromCart); 
// Route to remove an item from the cart (protected by auth middleware)

router.post('/cart/increase', auth, checkVerified, cartController.increaseItemQuantity);
// Route to increase the quantity of an item in the cart (protected by auth middleware)

router.post('/cart/decrease', auth, checkVerified, cartController.decreaseItemQuantity);
// Route to decrease the quantity of an item in the cart (protected by auth middleware)

router.delete('/cart/clear', auth, checkVerified, cartController.clearCart); 
// Route to clear all items from the cart (protected by auth middleware)

router.post('/cart/merge', auth, checkVerified, cartController.mergeCart);
// Route to merge the cart with another user's cart (protected by auth middleware)

module.exports = router; // Export the router to be used in the main app
