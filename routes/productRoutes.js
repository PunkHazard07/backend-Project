const express = require('express'); //to require express
const router = express.Router(); //to require router


//import the Multer middleware
const upload = require('../middleware/multer.js'); //to require upload

//importing the product controller
const { addProduct, listProducts, removeProduct, singleProduct, updateProduct, latestProducts, bestsellingProducts, productsByIndoorCategory, productsByOutdoorCategory } = require('../controllers/productController.js'); //to require addProduct, listProducts, removeProduct, singleProduct
const { adminAuth } = require('../middleware/adminAuth.js');

//creating endpoint for products
//use multer middleware for handling file upload
router.post('/add', adminAuth, upload.single('image'),addProduct); //endpoint for adding a product, `image` is the name of the file field in the request    ....DON'T FORGET TO TEST.....
router.post('/remove', adminAuth, removeProduct); //endpoint for removing a product ....DON'T FORGET TO TEST.....

// Getting products by category
router.get('/products/indoor-category', productsByIndoorCategory);
router.get('/products/outdoor-category', productsByOutdoorCategory);


router.get('/single/:id', singleProduct); // Correct GET route
router.get('/products', listProducts); //endpoint for listing products
router.get('/latest', latestProducts); // endpoint for latest products
router.get('/bestselling', bestsellingProducts) // endpoint for bestselling products
router.put('/update',adminAuth, updateProduct); //endpoint for updating


//exporting the router
module.exports = router; //to export the router