const cloudinary = require('cloudinary').v2; //to require cloudinary
require("dotenv").config();

//initialize cloudinary

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

module.exports = cloudinary; //export the configured cloudinary object