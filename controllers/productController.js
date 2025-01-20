const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary')

// Add a new product
exports.addProduct = async (req, res) => {
    //dont forget to add authentication so that only admin can add product
    
    try {
        //access uploaded file details
        const file = req.file; //contains information about the uploaded file
        const {name,description, price, category, bestseller} = req.body; //access other product details

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
            price,
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

        res.status(200).json({ product });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};