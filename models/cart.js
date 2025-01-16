const mongoose = require('mongoose'); //to require mongoose
const User = require('./User');


const ItemSchema = new mongoose.Schema({
    productID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: [1, 'Quantity cannot be less than 1']
    },

    price: {
        type: Number,
        required: true,
        min: [1, 'Price cannot be less than 1']
    },
    
}, {timestamps: true})

const CartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    items: [ItemSchema],
    total: {
        default: 0,
        type: Number,
        required: true
    }
}, {timestamps: true});

//export the model
module.exports = mongoose.model('Cart', CartSchema); //to export the model