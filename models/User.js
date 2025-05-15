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
    },
    verified: {
        type: Boolean,
        default: false // to set the default value to false
    }, 
    verificationToken: {
        type: String,
        default: null // to set the default value to null
    },
    verificationTokenCreatedAt: {
        type: Date,
        default: null // to track when the verification token was created
    },
    resetPasswordToken: {
        type: String,
        default: null // to set the default value to null
    },
    resetPasswordExpires: {
        type: Date,
        default: null // to track when the reset password token expires
    },

    lastLoginAttempt: {
        type: Date,
        default: null // to track the last login attempt for additional security
    },
    failedLoginAttempts: {
        type: Number,
        default: 0 // to track failed login attempts
    }
}, {
    timestamps: true, // to add createdAt and updatedAt fields
    minimize: false
}); //to set minimize to false

//to export the schema
module.exports = mongoose.model("user", userSchema)

