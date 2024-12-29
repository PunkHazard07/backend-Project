const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary')

// Add a new product
exports.addProduct = async (req, res) => {
    try {
        //access uploaded file details
        const file = req.file; //contains information about the uploaded file
        const {name,description, price, category, subCategory, material} = req.body; //access other product details

        //validate required fields
        if(!name || !description || !price || !category || !subCategory){
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
            subCategory,
            material
        });
        //save the product to the database
        const savedProduct = await newProduct.save();   

        res.status(201).json({message: "Product added successfully", product: savedProduct});
    } catch (error) {
        res.status(500).json({message: "Internal server error", error: error.message});
    }

};

//function for list product
exports.listProducts = async (req, res) => {
    
};


//function to remove product
exports.removeProduct = async (req, res) => {
    
};


//function to get single product info
exports.singleProduct = async (req, res) => {
    
};