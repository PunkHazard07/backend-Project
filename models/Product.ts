import mongoose, { Schema, type Document } from 'mongoose';

interface IProduct extends Document {
    name: string;
    description: string;
    images: string[];
    imagePublicId?: string;
    price: number;
    category: 'Living Room' | 'Bedroom' | 'Dining Room' | 'Mirror';
    quantity: number;
    isOutOfStock: boolean;
    createdAt: Date;
    updatedAt: Date;
}

//to create a schema for the product
const productSchema = new Schema<IProduct>({
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        images: {
            type: [String],
            required: true
        },
        imagePublicId: {
            type: String
        },
        price: {
            type: Number,
            required: true
        },
        category: {
            type: String,
            enum: ['Living Room', 'Bedroom', 'Dining Room', 'Mirror'],
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0, // Minimum quantity is 0
        },
        isOutOfStock: {
            type: Boolean,
            default: false, // Default to false, meaning the product is in stock
        },
}, {timestamps: true});

//to export the model
export = mongoose.model<IProduct>('Product', productSchema);
