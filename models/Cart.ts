import mongoose, { Schema, Types, type Document } from 'mongoose';

export interface ICartItem {
    productId: Types.ObjectId;
    quantity: number;
}

export interface ICart extends Document {
    user: Types.ObjectId;
    items: ICartItem[];
    createdAt: Date;
    updatedAt: Date;
}

const CartItemSchema = new Schema<ICartItem>(
    {
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity cannot be less than 1']
    },    
}, 
{ _id: false });

const CartSchema = new Schema<ICart>({
        user: {
            type: Schema.Types.ObjectId,
            ref: 'user',
            required: true,
            unique: true,
        },
        items: {
            type: [CartItemSchema],
            default: [],
        },
}, { timestamps: true });

export default mongoose.model<ICart>('Cart', CartSchema);