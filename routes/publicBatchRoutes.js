// routes/projectBatchRoutes.js
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

module.exports = router;