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
            type: mongoose.Schema.Types.ObjectId, ref: "Category",
            required: true
        },
        subCategory: {
            type: mongoose.Schema.Types.ObjectId, ref: "SubCategory",
            required: true
        },
        dimensions: {
            width:{type: Number, required: true},
            height:{type: Number, required: true},
            depth:{type: Number, required: true}
        },
        matrial: {
            type: String,
            enum: ['Wood', 'Metal', 'frameless', "plastic"],
            required: true
        },
        stock: {
            type: Number,
            default: 0,
            required: true
        },
        timestamps: true //automatically add the createdAt and updatedAt fields
}); 

//to export the model
module.exports = mongoose.model('Product', productSchema);
