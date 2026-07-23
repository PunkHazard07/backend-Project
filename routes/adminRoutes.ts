import express from 'express';
const router = express.Router();
import * as controller from '../controllers/adminController';
// const { adminAuth } = require ('../middleware/adminAuth.js')

//creating endpoint for admin
router.post('/register-admin', controller.registerAdmin); //endpoint for admin registration
router.post('/login-admin', controller.adminLogin); //endpoint for admin login
router.post('/logout-admin', controller.logoutadmin); //endpoint for admin logout
router.post('/verify-token', controller.verifyToken); //endpoint for verifying token

//exporting the router
export default router;