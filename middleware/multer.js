const multer = require('multer'); //to require multer


// Set up multer
const storage = multer.diskStorage({
    // Destination for files
    filename: (req, file, callback) => {
        callback(null, file.originalname);
    }
});

//upload middleware
const upload = multer({ storage: storage });


//exporting the upload
module.exports = upload; //to export the upload