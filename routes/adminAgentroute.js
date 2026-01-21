// routes/adminAgentRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAgentApplications,
  getAgentById,
  searchAgents,
  approveAgent,
  rejectAgent,
  setAgentToPending,
  suspendAgent,
  reactivateAgent,
  getAgentStats
} = require('../controllers/adminAgentController');

// Import protect and authorize middleware
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require admin access
router.use(protect);
router.use(authorize('admin'));

// Agent applications routes
router.get('/applications', getAgentApplications);
router.get('/stats', getAgentStats);

// Search agents
router.get('/search', searchAgents);
router.get('/:agentId', getAgentById);

// Agent approval actions
router.put('/:userId/approve', approveAgent);
router.put('/:userId/reject', rejectAgent);
router.put('/:userId/pending', setAgentToPending);
router.put('/:userId/suspend', suspendAgent);
router.put('/:userId/reactivate', reactivateAgent);

module.exports = router;