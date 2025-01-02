const User = require('../models/User.js'); //importing user model
const validator = require('validator'); //to require validator
const bcrypt = require('bcrypt'); //to require bcrypt
const jwt = require('jsonwebtoken'); //to require jsonwebtoken
// console.log("your JWT Secret is: ", process.env.JWT_SECRET); //to test if it is working

//creating endpoint for users

//generating token
const createToken =(id) => {
    return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn: '1d'}); //to create a token
}

//endpoint for user login
exports.loginUser = async (req, res) => {
    //logic for user login
    try {
        const {email, password} = req.body; //to get the email and password from the request body

        const user = await User.findOne({email}); //to find the user by email
        if (!user) {
            return res.status(400).json({ success:false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password); //to compare the password
        
        if (isMatch){
            const token = createToken(user._id); //to create a token
            res.status(200).json({ success:true, message: "User logged in successfully", token });  
        } else{
            res.status(400).json({ success:false, message: "Invalid credentials" });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: error.message });
    }


};

//endpoint for user registration
exports.registerUser = async (req, res) => {
    //logic for user registration
    try {
        const { username, email, password } = req.body; //to get the username, email and password from the request body
        //checking if the user already exist
        const exists = await User.findOne({ email }); //to find the user by email
        if (exists) {
        return res.status(400).json({ success:false, message: "User already exists" });
        } 
        //checking if the email is valid
        if (!validator.isEmail(email)) {
        return res.status(400).json({ success:false, message: "Invalid email" });
        }
    
        //hashing the password
        const salt = await bcrypt.genSalt(10); //to generate a salt
        const hashedPassword = await bcrypt.hash(password, salt); //to hash the password

        //creating a new user
        const user = new User({
        username,
        email,
        password: hashedPassword
        });

        //saving the user
        const savedUser = await user.save() //to save the user;
        
        //creating a token
        const token = createToken(savedUser._id);

        //sending the response
        res.status(200).json({ success:true, message: "User registered successfully", token });
        

    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: error.message });
    }


};

//endpoint for user logout
exports.logoutUser = async (req, res) => {
    //logic for user logout
    try {
        res.status(200).json({ success:true, message: "User logged out successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: error.message });
    }

};









