"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteImageIfExists = exports.uploadImageBuffer = exports.IMAGE_FOLDER = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
exports.IMAGE_FOLDER = process.env.NODE_ENV === 'production' ? 'product-images' : 'dev/product-images';
const uploadImageBuffer = (buffer, folder = exports.IMAGE_FOLDER) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.default.uploader.upload_stream({ folder }, (error, result) => {
            if (error || !result) {
                return reject(error || new Error('Cloudinary upload failed'));
            }
            resolve({ secure_url: result.secure_url, public_id: result.public_id });
        });
        stream.end(buffer);
    });
};
exports.uploadImageBuffer = uploadImageBuffer;
const deleteImageIfExists = async (publicId) => {
    if (!publicId)
        return;
    try {
        await cloudinary_1.default.uploader.destroy(publicId);
    }
    catch (error) {
        // Don't let a Cloudinary cleanup failure block the actual DB operation
        console.error('Failed to delete Cloudinary image:', publicId, error);
    }
};
exports.deleteImageIfExists = deleteImageIfExists;
//# sourceMappingURL=cloudinaryUpload.js.map