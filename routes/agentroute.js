const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/agentController');
const { protect, admin } = require('../middleware/auth');

// Admin property routes
router.post('/admin/properties', protect, admin, propertyController.createPropertyByAdmin);
router.put('/admin/properties/:id', protect, admin, propertyController.updatePropertyByAdmin);
router.get('/admin/properties/with-agents', protect, admin, propertyController.getPropertiesWithAgents);
router.get('/admin/properties/:id', protect, admin, propertyController.getPropertyById);
router.delete('/admin/properties/:id', protect, admin, propertyController.deletePropertyByAdmin);
router.patch('/admin/properties/bulk-update', protect, admin, propertyController.bulkUpdateProperties);
router.get('/admin/properties/stats/dashboard', protect, admin, propertyController.getPropertyStats);

module.exports = router;