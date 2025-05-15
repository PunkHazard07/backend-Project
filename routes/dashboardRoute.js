const express = require('express');
const router = express.Router(); // Create an instance of the express router
const { getDashboardMetrics, getSpecificMetric } = require('../controllers/dashboard.js'); // Import the dashboard controller
const { adminAuth } = require('../middleware/adminAuth.js'); // middleware to protect routes for admin

//mount route
router.get('/dashMetrics', adminAuth, getDashboardMetrics); // Route to get dashboard metrics
router.get('/metrics/:metricType', adminAuth, getSpecificMetric); // Route to get a specific metric


// Export the router
module.exports = router; // Export the router