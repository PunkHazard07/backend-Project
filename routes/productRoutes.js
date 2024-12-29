const express = require('express'); //to require express
const router = express.Router(); //to require router

//import the Multer middleware
const upload = require('../middleware/multer.js'); //to require upload

//importing the product controller
const { addProduct, listProducts, removeProduct, singleProduct } = require('../controllers/productController.js'); //to require addProduct, listProducts, removeProduct, singleProduct

//creating endpoint for products
//use multer middleware for handling file upload
router.post('/add', upload.single('image'),addProduct); //endpoint for adding a product, `image` is the name of the file field in the request 
router.post('/remove', removeProduct); //endpoint for removing a product
router.post('/single', singleProduct); //endpoint for getting a single product
router.get('/list', listProducts); //endpoint for listing products


//exporting the router
module.exports = router; //to export the router