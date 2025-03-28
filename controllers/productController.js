const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary')

// Add a new product
exports.addProduct = async (req, res) => {
    //dont forget to add authentication so that only admin can add product
    
    try {
        //access uploaded file details
        const file = req.file; //contains information about the uploaded file
        const {name,description, price, category, bestseller} = req.body; //access other product details

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
            bestseller: bestseller || false //set the bestseller status if provided, default to false
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
exports.listProducts = async (req, res) => {
    try {
        //fetch all products from the database
        const products = await Product.find();
        res.status(200).json({products});
    } catch (error) {
        console.log(error);
        res.status(500).json({message: "Internal server error", error: error.message});
    }
};


//function to remove product
exports.removeProduct = async (req, res) => {

    //dont forget to add authentication so that only admin can delete
    try {
        const { id } = req.body;

        // Check if the product exists
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Remove the product from the database
        await Product.findByIdAndDelete(id);

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


// Get product by category: indoor product
exports.productsByIndoorCategory = async (req, res) => {
    try {
        // Fetch all indoor products from the database
        const indoorProducts = await Product.find({ category: "Indoor" });

        if (!indoorProducts) {
            return res.status(404).json({ message: "No indoor products found" });
        }

        res.status(200).json({ indoorProducts });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Get product by category: outdoor product
exports.productsByOutdoorCategory = async (req, res) => {
    try {
        // Fetch all outdoor products from the database
        const outdoorProducts = await Product.find({ category: "Outdoor" });

        if (!outdoorProducts) {
            return res.status(404).json({ message: "No outdoor products found" });
        }

        res.status(200).json({ outdoorProducts });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Fetch Product from Highest to Lowest by price

//update product info
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params; // Product ID from request parameters
        const { name, description, price, category, bestseller } = req.body; // Other product details
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
        if (bestseller !== undefined) product.bestseller = bestseller;

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
        const products = await Product.find().sort({ createdAt: -1 }).limit(5);

        res.status(200).json({ products });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// endpoint for bestselling products

exports.bestsellingProducts = async (req, res) => {
    try {
        // Fetch the bestselling products from the database
        const products = await Product.find({ bestseller: true }).sort({ createdAt: -1 });

        res.status(200).json({ products });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};