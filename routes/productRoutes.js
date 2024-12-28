const express = require('express'); //to require express
const router = express.Router(); //to require router

//importing the product controller
const { addProduct, listProducts, removeProduct, singleProduct } = require('../controllers/productController.js'); //to require addProduct, listProducts, removeProduct, singleProduct

//creating endpoint for products
router.post('/add', addProduct); //endpoint for adding a product
router.post('/remove', removeProduct); //endpoint for removing a product
router.post('/single', singleProduct); //endpoint for getting a single product
router.get('/list', listProducts); //endpoint for listing products


//exporting the router
module.exports = router; //to export the router