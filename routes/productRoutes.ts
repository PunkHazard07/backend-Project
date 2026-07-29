import express from 'express';
const router = express.Router(); 

//import the Multer middleware
import upload from '../middleware/multer';
import { adminAuth } from '../middleware/adminAuth';

//importing the product controller
import { getCategoriesWithCounts, getProductsByCategory } from '../controllers/categoryController';
import { addProduct, listProducts, removeProduct, singleProduct, updateProduct, latestProducts } from '../controllers/productController';

//creating endpoint for products
router.post('/add', adminAuth, upload.single('image'),addProduct); 
router.delete('/remove/:id', adminAuth, removeProduct); 

// Getting products by category
router.get('/categories', getCategoriesWithCounts); 
router.get('/categories/:category', getProductsByCategory); 

// other product endpoint 
router.get('/single/:id', singleProduct); 
router.get('/products', listProducts); 
router.get('/latest', latestProducts); 
router.put('/update/:id', adminAuth, upload.single('image'), updateProduct);


//exporting the router
export default router;