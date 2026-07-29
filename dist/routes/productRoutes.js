"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
//import the Multer middleware
const multer_1 = __importDefault(require("../middleware/multer"));
const adminAuth_1 = require("../middleware/adminAuth");
//importing the product controller
const categoryController_1 = require("../controllers/categoryController");
const productController_1 = require("../controllers/productController");
//creating endpoint for products
router.post('/add', adminAuth_1.adminAuth, multer_1.default.single('image'), productController_1.addProduct);
router.delete('/remove/:id', adminAuth_1.adminAuth, productController_1.removeProduct);
// Getting products by category
router.get('/categories', categoryController_1.getCategoriesWithCounts);
router.get('/categories/:category', categoryController_1.getProductsByCategory);
// other product endpoint 
router.get('/single/:id', productController_1.singleProduct);
router.get('/products', productController_1.listProducts);
router.get('/latest', productController_1.latestProducts);
router.put('/update/:id', adminAuth_1.adminAuth, multer_1.default.single('image'), productController_1.updateProduct);
//exporting the router
exports.default = router;
//# sourceMappingURL=productRoutes.js.map