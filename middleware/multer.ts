import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

const storage = multer.memoryStorage();

// Only allow image uploads
const fileFilter = (req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        callback(null, true);
    } else {
        callback(new Error('Only image files are allowed'));
    }
};

// Upload middleware
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

//exporting the upload
export = upload; //to export the upload