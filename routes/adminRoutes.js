const express = require('express');
const router = express.Router();

//importing the admin controller
const { registerAdmin, adminLogin, logoutadmin, verifyToken } = require('../controllers/adminController.js');
// const { adminAuth } = require ('../middleware/adminAuth.js')

//creating endpoint for admin
router.post('/register-admin', registerAdmin); //endpoint for admin registration
router.post('/login-admin', adminLogin); //endpoint for admin login
router.post('/logout-admin',logoutadmin); //endpoint for admin logout
router.post('/verify-token', verifyToken); //endpoint for verifying token

//exporting the router
module.exports = router; //to export the router