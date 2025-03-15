const express = require('express');
const router = express.Router();

//importing the admin controller
const { registerAdmin, adminLogin, logoutadmin } = require('../controllers/adminController.js');

//creating endpoint for admin
router.post('/register', registerAdmin); //endpoint for admin registration
router.post('/login', adminLogin); //endpoint for admin login
router.post('/logout', logoutadmin); //endpoint for admin logout

//exporting the router
module.exports = router; //to export the router