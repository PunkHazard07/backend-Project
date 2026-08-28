import express from 'express';
const router = express.Router();
import * as controller from '../controllers/adminController';

//creating endpoint for admin
router.post('/register-admin', controller.registerAdmin); 
router.post('/login-admin', controller.adminLogin); 
router.post('/logout-admin', controller.logoutadmin); 
router.post('/verify-token', controller.verifyToken);

//exporting the router
export default router;