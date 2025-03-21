const express = require('express'); //to require express
const router = express.Router(); //to require router

//importing user controller
const { loginUser, registerUser, logoutUser  } = require('../controllers/userController.js'); //to require loginUser, registerUser, logoutUser

//creating endpoint for users
router.post('/login', loginUser); //endpoint for user login
router.post('/register', registerUser); //endpoint for user registration
router.post('/logoutUser', logoutUser); //endpoint for user logout

//exporting the router
module.exports = router; //to export the router