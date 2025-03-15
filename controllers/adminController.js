const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');



//route for admin registration
exports.registerAdmin = async (req, res) => {
    //logic for admin registration
    try {
        const { email, password} = req.body; //to get the email and password from the request body

        //check if the admin already exists
        const exists = await Admin.findOne({email}); //to find the admin by email
        if (exists) {
            return res.status(400).json({ success:false, message: "Admin already exists" });
        }

        //hash the password
        const salt = await bcrypt.genSalt(10); //to generate a salt
        const hashedPassword = await bcrypt.hash(password, salt); //to hash the password

        //create a new admin
        const newAdmin = new Admin({email, password: hashedPassword}); //to create a new admin
        const savedAdmin = await newAdmin.save(); //to save the admin to the database

        //send success response with token
        res.status(201).json({ success: true, message: "Admin registered successfully" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: error.message });
    }
}

//route for admin login
exports.adminLogin = async (req, res) => {
    //logic for admin login
    try {
        
        const {email, password} = req.body; //to get the email and password from the request body

        //find admin in database
        const admin = await Admin.findOne({ email }); //to find the admin by email
        if (!admin) {
            return res.status(400).json({ success:false, message: "Admin not found" });
        }
        //compare hashed password
        const isMatch = await bcrypt.compare(password, admin.password); //to compare the password
        if (!isMatch){
            return res.status(400).json({ success:false, message: "Invalid credentials" });
        }

        //create token
        const token = jwt.sign({ id: admin._id, role: "admin" },
            process.env.JWT_SECRET, { expiresIn: '2h' }); //to create a token`

        res.status(200).json({ success:true, message: "Admin logged in successfully", token });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: error.message });
    }
};



//endpoint for admin logout
exports.logoutadmin = async (req, res) => {
    //logic for user logout
    try {
        res.status(200).json({ success:true, message: "Admin logged out successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success:false, message: error.message });
    }

};