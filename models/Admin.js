const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Create a schema
const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
});

// Hash password before saving
adminSchema.pre('save', async function (next){
    if (!this.isModified('password')) return next();{
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    }
});

//compare passwords
adminSchema.methods.comparePasswords = async function (enteredPassword){
    return await bcrypt.compare(enteredPassword, this.password);
};

// Export the model
module.exports = mongoose.model('Admin', adminSchema); // Export the model