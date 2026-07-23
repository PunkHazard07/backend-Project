import express from 'express'; 
const router = express.Router(); 
const { authLimiter, emailLimiter } = require('../middleware/rateLimiter.js'); //to require rate limiter middleware
import * as controller from '../controllers/userController';
import { auth, checkVerified } from '../middleware/auth';
//creating endpoint for users
router.post('/login', authLimiter, controller.loginUser); 
router.post('/register', authLimiter, controller.registerUser); 
router.post('/logoutUser', auth, checkVerified, controller.logoutUser);
router.get('/verify-email', emailLimiter, controller.verifyEmail); 
router.post('/resend-verification', emailLimiter, controller.resendVerificationEmail); 
router.get("/user/profile", auth, checkVerified, controller.getUserProfile);
router.post('/forgot-password', emailLimiter, controller.forgotPassword); 
router.post('/reset-password', emailLimiter, authLimiter, controller.resetPassword); 
router.get('/verify-reset-token', emailLimiter, controller.verifyResetToken ); 

//exporting the router
export default router;