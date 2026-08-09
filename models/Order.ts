import mongoose, { Schema, type Document, type Types } from 'mongoose';

interface IOrderItem {
    productId: Types.ObjectId;
    quantity: number;
    price: number;
    name: string;
}

interface IShippingDetails {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string;
}

interface IOrder extends Document {
    userId: Types.ObjectId;
    items: IOrderItem[];
    amount: number;
    status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
    shippingDetails: IShippingDetails;
    isPaid: boolean;
    isArchived: boolean;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
}

const orderSchema = new Schema<IOrder>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    items: [{
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 1 },
        name: { type: String, required: true },
    }],
    amount: {
        type: Number,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending',
    },
    shippingDetails: {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String, required: true },
        address: { type: String, required: true },
    },
    isPaid: {
        type: Boolean,
        default: false, // cached flag, written by the Payment success handler
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    date: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

export = mongoose.model<IOrder>('Order', orderSchema);