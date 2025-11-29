// routes/adminPropertyRoutes.js
const express = require('express');
const router = express.Router();
const adminPropertyController = require('../controllers/agentController'); // Fixed controller name
const upload = require('../middlewares/multer');
const { protect, authorize } = require('../middleware/authMiddleware'); // Destructure properly

// Apply protect middleware to all routes
router.use(protect);

// Admin property management routes
router.post('/properties', authorize('admin'), upload.array('images', 10), adminPropertyController.createPropertyByAdmin);
router.put('/properties/:id', authorize('admin'), upload.array('images', 10), adminPropertyController.updatePropertyByAdmin);
router.get('/properties/with-agents', authorize('admin'), adminPropertyController.getPropertiesWithAgents);
router.get('/properties/:id', authorize('admin'), adminPropertyController.getPropertyById);
router.delete('/properties/:id', authorize('admin'), adminPropertyController.deletePropertyByAdmin);
router.get('/agents/list', authorize('admin'), adminPropertyController.getAgentsList);
router.get('/properties-stats', authorize('admin'), adminPropertyController.getPropertyStats);
router.put('/properties/:id/assign-agent', authorize('admin'), adminPropertyController.assignAgentToProperty);





// Create
router.post("/", authorize('admin'), adminPropertyController.createAgent);

// Get all (with pagination + search)
router.get("/", authorize('admin'), adminPropertyController.getAllAgents);

// Get single by ID
router.get("/:id",  authorize('admin'),adminPropertyController.getAgentById);

// Update
router.put("/:id", authorize('admin'), adminPropertyController.updateAgent);

// Delete
router.delete("/:id",  authorize('admin'),adminPropertyController.deleteAgent);

// Get properties of a specific agent
router.get("/:id/properties", authorize('admin'), adminPropertyController.getAgentProperties);

module.exports = router;