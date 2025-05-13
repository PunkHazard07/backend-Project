const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');
const jwt = require('jsonwebtoken');

// Add a new product
exports.addProduct = async (req, res) => {
    //dont forget to add authentication so that only admin can add product
    
    try {
        //access uploaded file details
        const file = req.file; //contains information about the uploaded file
        const {name,description, price, category, quantity} = req.body; //access other product details

        //convert price to number 
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice)) {
            return res.status(400).json({ message: "Price must be a number" });
        }

        //validate required fields
        if(!name || !description || !price || !category){
            return res.status(400).json({message: "All fields are required"});
        }
        let uploadedImages;
        if (file) {
            //upload the file to  cloudinary using the file path from multer
            const result = await cloudinary.uploader.upload(file.path, {
                folder: "product-images" // Organize in a Cloudinary folder
            });
            uploadedImages = result.secure_url; //save the secure url of the uploaded image
        }
        
        
        //create new product instance
        const newProduct = new Product({
            images: uploadedImages || null, //save the image to the url if an image is uploaded
            name,
            description,
            price: parsedPrice, //save converted price
            category,
            quantity,
            isOutOfStock: quantity <= 0 // Set out of stock if quantity is 0
        });
        //save the product to the database
        const savedProduct = await newProduct.save(); 
        

        res.status(201).json({message: "Product added successfully", product: savedProduct});

    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Internal server error", error: error.message});
    }

};

//function for list product   

/// Updated List Product controller
exports.listProducts = async (req, res) => {
    try {
        let { category, sort } = req.query; // Get category and sort query params
        let filter = {}; // Default: No filter (fetch all products)

        // Apply category filter if provided
        if (category) {
            filter.category = category;
        }

        // Fetch products from the database based on the filter
        let products = await Product.find(filter);

        // Apply sorting
        if (sort === "low-high") {
            products.sort((a, b) => a.price - b.price);
        } else if (sort === "high-low") {
            products.sort((a, b) => b.price - a.price);
        }

        res.status(200).json({ products });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



//function to remove product
exports.removeProduct = async (req, res) => {

    //dont forget to add authentication so that only admin can delete
    try {
        const productId = req.params.id; // Get the ID from the request parameters

        // Check if the product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Remove the product from the database
        await Product.findByIdAndDelete(productId);

        res.status(200).json({ message: "Product removed successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


//function to get single product info
exports.singleProduct = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the product by ID from the database
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        res.status(200).json(product);    
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// 
//update product info
exports.updateProduct = async (req, res) => {
    try {
        // check authentication
        const token = req.header('Authorization')?.split(' ')[1]; //get token from headers 
        if(!token) return res.status(401).json({ message: "Unauthorized" });

        //verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded || decoded.role !== "admin") {
            return res.status(403).json({ message: "Forbidden: Admins only" });
        }

        const { id } = req.params; // Product ID from request parameters
        const { name, description, price, category, quantity } = req.body; // Other product details
        const file = req.file; // Uploaded file for a new image (optional)

        // Find the product by ID
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // If a new file is provided, upload it to Cloudinary and update the image
        if (file) {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: "product-images"
            });
            product.images = result.secure_url; // Update image URL in product
        }

        // Update only fields provided in the request body
        if (name) product.name = name;
        if (description) product.description = description;
        if (price) product.price = price;
        if (category) product.category = category;
        if (quantity !== undefined) {
            product.quantity = quantity;
            product.isOutOfStock = quantity <= 0; // Automatically set stock status
        }

        // Save the updated product
        const updatedProduct = await product.save();

        res.status(200).json({ message: "Product updated successfully", product: updatedProduct });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


//endpoint for latest product
exports.latestProducts = async (req, res) => {
    try {
        // Fetch the latest 5 products from the database
        const products = await Product.find().sort({ createdAt: -1 }).limit(8);

        res.status(200).json({ products });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};