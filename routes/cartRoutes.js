const express = require('express'); //to require express
const cartController = require('../controllers/cartController'); //to require cartController
const authMiddleware = require('../middleware/auth'); //to require authMiddleware

const router = express.Router(); //to create an instance of express

//mounting the cart routes
router.get('/cart', authMiddleware.auth, cartController.getCart); //to get the cart
router.post('/add', authMiddleware.auth, cartController.addItemToCart); //to add item to cart
router.post('/remove', authMiddleware.auth, cartController.removeItemFromCart); //to remove item from cart
router.put('/update', authMiddleware.auth, cartController.updateItemInCart); //to update cart
router.delete('/clear', authMiddleware.auth, cartController.clearCart); //to clear cart


module.exports = router; //to export the router
