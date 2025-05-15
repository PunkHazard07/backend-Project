const express = require('express'); //to require express
const router = express.Router(); //to require router
const { authLimiter, emailLimiter } = require('../middleware/rateLimiter.js'); //to require rate limiter middleware

//importing user controller
const { 
    loginUser, 
    registerUser, 
    verifyEmail, 
    resendVerificationEmail, 
    logoutUser, 
    getUserProfile,
    forgotPassword,
    verifyResetToken,
    resetPassword
   } = require('../controllers/userController.js'); //destructure the functions from userController
const { auth, checkVerified } = require('../middleware/auth.js'); //to require auth middleware

//creating endpoint for users
router.post('/login', authLimiter, loginUser); //endpoint for user login
router.post('/register', authLimiter, registerUser); //endpoint for user registration
router.post('/logoutUser', auth, checkVerified, logoutUser); //endpoint for user logout
router.get('/verify-email', emailLimiter, verifyEmail); //endpoint for email verification
router.post('/resend-verification', emailLimiter, resendVerificationEmail); //endpoint for resending verification email
router.get("/user/profile", auth, checkVerified, getUserProfile);
router.post('/forgot-password', emailLimiter, forgotPassword); //endpoint for forgot password
router.post('/reset-password', emailLimiter, authLimiter, resetPassword); //endpoint for verifying reset token
router.get('/verify-reset-token', emailLimiter, verifyResetToken ); //endpoint for resetting password

//exporting the router
module.exports = router; //to export the router