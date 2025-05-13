const mongoose = require('mongoose'); //to require mongoose

//to create a schema for the product
const productSchema = new mongoose.Schema({
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
}, {timestamps: true}); //add timestamps to the schema

//to export the model
module.exports = mongoose.model('Product', productSchema);
