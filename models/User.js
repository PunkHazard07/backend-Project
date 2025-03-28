const mongoose = require('mongoose'); //to require mongoose

//to create a schema for user
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    cartData: {
        type: Array,
        default: [] // to set the default value to an empty array
    }
}, {minimize: false}); //to set minimize to false

//to export the schema
module.exports = mongoose.model("user", userSchema)

