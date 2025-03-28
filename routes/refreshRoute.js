const express = require('express'); // Require express
const router = express.Router();     // Create a router
const { refreshToken } = require('../controllers/refreshController.js');    // Create a POST endpoint for refreshing tokens

// Create a POST endpoint for refreshing tokens
router.post('/refresh-token', refreshToken);

// Export the router
module.exports = router;