const express = require('express');
const router = express.Router();
const projectBatchController = require('../controllers/publicBatchController');

// Public routes for project batches only

// Get all project batches with pagination
// GET /api/batches/project?page=1&limit=6&sortBy=displayOrder&sortOrder=asc
router.get('/project', projectBatchController.getProjectBatches);

// Get project batches with advanced filtering
// GET /api/batches/project/filter?page=1&limit=6&search=premium&location=mumbai
router.get('/project/filter', projectBatchController.filterProjectBatches);

// Get featured project batches (top N)
// GET /api/batches/project/featured?limit=3
router.get('/project/featured', projectBatchController.getFeaturedProjectBatches);

// Get single project batch by ID
// GET /api/batches/project/:id
router.get('/project/:id', projectBatchController.getProjectBatchById);

// ========== NEW: LOCATION BASED BATCHES ROUTES ==========

// Get all location-based batches with pagination
// GET /api/batches/location?page=1&limit=6&sortBy=displayOrder&sortOrder=asc
router.get('/location', projectBatchController.getLocationBatches);

// Get location batches with advanced filtering
// GET /api/batches/location/filter?page=1&limit=6&search=premium&city=mumbai
router.get('/location/filter', projectBatchController.filterLocationBatches);

// Get featured location batches (top N)
// GET /api/batches/location/featured?limit=3
router.get('/location/featured', projectBatchController.getFeaturedLocationBatches);

// Get single location batch by ID
// GET /api/batches/location/:id
router.get('/location/:id', projectBatchController.getLocationBatchById);

module.exports = router;