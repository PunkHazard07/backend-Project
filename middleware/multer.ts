import multer, { MulterError, type FileFilterCallback } from 'multer';
import type { Request, Response, NextFunction } from 'express';

const storage = multer.memoryStorage();

// Only allow image uploads
const fileFilter = (req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        callback(null, true);
    } else {
        callback(new Error('Only image files are allowed'));
    }
};

const MAX_FILE_SIZE_MB = 10;

// Upload middleware
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    },
});

export const uploadSingle = (fieldName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        upload.single(fieldName)(req, res, (error: unknown) => {
            if (error instanceof MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.`
                    });
                }
                return res.status(400).json({ success: false, message: error.message });
            }
            if (error) {
                return res.status(400).json({ success: false, message: (error as Error).message })
            }
            next();
        });
    };
};

//exporting the upload
export default upload; 