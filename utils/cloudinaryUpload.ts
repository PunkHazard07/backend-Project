import cloudinary from '../config/cloudinary';

export const IMAGE_FOLDER = process.env.NODE_ENV === 'production' ? 'product-images' : 'dev/product-images';

export interface CloudinaryUploadResult {
    secure_url: string;
    public_id: string;
}

export const uploadImageBuffer = (buffer: Buffer, folder: string = IMAGE_FOLDER): Promise<CloudinaryUploadResult> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error: any, result: any) => {
                if (error || !result) {
                    return reject(error || new Error('Cloudinary upload failed'));
                }
                resolve({ secure_url: result.secure_url, public_id: result.public_id });
            }
        );
        stream.end(buffer);
    });
};

export const deleteImageIfExists = async (publicId?: string) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        // Don't let a Cloudinary cleanup failure block the actual DB operation
        console.error('Failed to delete Cloudinary image:', publicId, error);
    }
};