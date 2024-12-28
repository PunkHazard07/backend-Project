const {v2: cloudinary} = require('cloudinary');

const connectCloudinary =  async () => {
cloudinary.config({
    //function to configure cloudinary
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

}

module.exports = connectCloudinary; //to export the function