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
            enum: ['Indoor', 'Outdoor'],
            required: true
        },

        bestseller: {
            type: Boolean,
            default: false,
        },
        
        stock: {
            type: Number,
            default: 0,
            required: true
        }
        
}, {timestamps: true}); //add timestamps to the schema

//to export the model
module.exports = mongoose.model('Product', productSchema);
