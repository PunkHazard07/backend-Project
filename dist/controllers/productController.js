"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestProducts = exports.updateProduct = exports.singleProduct = exports.removeProduct = exports.listProducts = exports.addProduct = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const cloudinaryUpload_1 = require("../utils/cloudinaryUpload");
// Add a new product
const addProduct = async (req, res) => {
    try {
        //access uploaded file details
        const file = req.file;
        const { name, description, price, category, quantity } = req.body;
        //validate required fields
        if (!name || !description || !price || !category || quantity === undefined) {
            return res.status(400).json({ message: "All fields are required" });
        }
        //convert price and quantity to numbers
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice)) {
            return res.status(400).json({ message: "Price must be a number" });
        }
        const parsedQuantity = parseFloat(quantity);
        if (isNaN(parsedQuantity)) {
            return res.status(400).json({ message: "Quantity must be a number" });
        }
        let uploadedImageUrl;
        let uploadedPublicId;
        if (file) {
            //upload the file buffer to cloudinary directly, no disk write
            const result = await (0, cloudinaryUpload_1.uploadImageBuffer)(file.buffer);
            uploadedImageUrl = result.secure_url;
            uploadedPublicId = result.public_id;
        }
        //create new product instance
        const newProduct = new Product_1.default({
            images: uploadedImageUrl ? [uploadedImageUrl] : [],
            imagePublicId: uploadedPublicId,
            name,
            description,
            price: parsedPrice,
            category,
            quantity: parsedQuantity,
            isOutOfStock: parsedQuantity <= 0 // Set out of stock if quantity is 0
        });
        //save the product to the database
        const savedProduct = await newProduct.save();
        res.status(201).json({ message: "Product added successfully", product: savedProduct });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
exports.addProduct = addProduct;
//function for list product   
const listProducts = async (req, res) => {
    try {
        let { category, sort } = req.query;
        let filter = {};
        // Apply category filter if provided
        if (category) {
            filter.category = category;
        }
        // Fetch products from the database based on the filter
        let products = await Product_1.default.find(filter);
        // Apply sorting
        if (sort === "low-high") {
            products.sort((a, b) => a.price - b.price);
        }
        else if (sort === "high-low") {
            products.sort((a, b) => b.price - a.price);
        }
        res.status(200).json({ products });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
exports.listProducts = listProducts;
//function to remove product
const removeProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        // Check if the product exists
        const product = await Product_1.default.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Clean up the Cloudinary image before removing the DB record
        await (0, cloudinaryUpload_1.deleteImageIfExists)(product.imagePublicId);
        // Remove the product from the database
        await Product_1.default.findByIdAndDelete(productId);
        res.status(200).json({ message: "Product removed successfully" });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
exports.removeProduct = removeProduct;
//function to get single product info
const singleProduct = async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch the product by ID from the database
        const product = await Product_1.default.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.status(200).json(product);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
exports.singleProduct = singleProduct;
//update product info
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, quantity } = req.body;
        const file = req.file;
        const product = await Product_1.default.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        if (file) {
            const result = await (0, cloudinaryUpload_1.uploadImageBuffer)(file.buffer);
            await (0, cloudinaryUpload_1.deleteImageIfExists)(product.imagePublicId);
            product.images = [result.secure_url];
            product.imagePublicId = result.public_id;
        }
        // Update only fields provided in the request body
        if (name)
            product.name = name;
        if (description)
            product.description = description;
        if (price !== undefined) {
            const parsedPrice = parseFloat(price);
            if (isNaN(parsedPrice)) {
                return res.status(400).json({ message: "Price must be a number" });
            }
            product.price = parsedPrice;
        }
        if (category)
            product.category = category;
        if (quantity !== undefined) {
            const parsedQuantity = parseFloat(quantity);
            if (isNaN(parsedQuantity)) {
                return res.status(400).json({ message: "Quantity must be a number" });
            }
            product.quantity = parsedQuantity;
            product.isOutOfStock = parsedQuantity <= 0;
        }
        const updatedProduct = await product.save();
        res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
exports.updateProduct = updateProduct;
//endpoint for latest product
const latestProducts = async (req, res) => {
    try {
        const products = await Product_1.default.find().sort({ createdAt: -1 }).limit(8);
        res.status(200).json({ products });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
exports.latestProducts = latestProducts;
//# sourceMappingURL=productController.js.map