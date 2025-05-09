const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
{
    userId: {
    type: String,
    required: true,
    },
    items: [
    {
        productId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Product",
            required: true 
        },
        quantity: { type: Number, required: true, min: 1 },
    },
    ],
    amount: {
    type: Number,
    required: true,
    },
    status: {
    type: String,
    enum: ["Pending", "Shipped","Delivered", "Cancelled"],
    default: "Pending",
    },
    address: {
    type: String,
    required: true,
    },
    paymentMethod: {
    type: String,
    enum: ["Paystack", "Cash"],
    required: true,
    },
    paymentStatus: {
    type: Boolean,
    default: false,
    },
    isArchived: {
    type: Boolean,
    default: false,
    },
    date: {
    type: Date,
    default: Date.now,
    },
},
{ timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
