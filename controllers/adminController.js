const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const { generateToken } = require('../utils/generateToken')

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

        //create a new admin
        const newAdmin = new Admin({email, password}); //to create a new admin
        await newAdmin.save(); //to save the admin to the database

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
        const { email, password } = req.body;

         // Ensure JWT_SECRET is defined
        if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
            return res.status(500).json({ success: false, message: "Server error: Missing JWT secrets" });
        }

        // Find admin in database
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(400).json({ success: false, message: "Admin not found" });
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        // Generate tokens (access & refresh)
        const { accessToken, refreshToken } = generateToken(admin);

        //save the token in the database
        admin.refreshToken = refreshToken;
        await admin.save();

        res.status(200).json({
            success: true,
            message: "Admin logged in successfully",
            accessToken,
            refreshToken
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
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

exports.verifyToken = (req, res) => {
    try {
        const authHeader = req.headers.authorization; // Corrected from req.header to req.headers
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Access denied. No token provided." });
        }

        const token = authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

        // Verify the token
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: "Invalid or expired token" });
            }
            res.json({ valid: true, user: decoded });
        });
    } catch (error) {
        // console.error("verify Token Error:", error.message);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
