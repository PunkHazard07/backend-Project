const express = require('express'); //to require express
const router = express.Router(); //to require router
const { authLimiter, emailLimiter } = require('../middleware/rateLimiter.js'); //to require rate limiter middleware

//importing user controller
const { loginUser, registerUser, verifyEmail, resendVerificationEmail, logoutUser  } = require('../controllers/userController.js'); //to require loginUser, registerUser, logoutUser

//creating endpoint for users
router.post('/login', authLimiter, loginUser); //endpoint for user login
router.post('/register', authLimiter, registerUser); //endpoint for user registration
router.post('/logoutUser', logoutUser); //endpoint for user logout
router.get('/verify-email', emailLimiter, verifyEmail); //endpoint for email verification
router.post('/resend-verification', emailLimiter, resendVerificationEmail); //endpoint for resending verification email

//exporting the router
module.exports = router; //to export the router