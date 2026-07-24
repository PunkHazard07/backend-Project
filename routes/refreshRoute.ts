import express from 'express';
const router = express.Router(); 
import { refreshToken } from '../controllers/refreshController';    

// Create a POST endpoint for refreshing tokens
router.post('/refresh-token', refreshToken);

// Export the router
export default router;