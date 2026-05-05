// routes/adminAgentRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllAgents,
  getGlobalAgentStats,
  getAgentSummary,
  getAgentReferredUsers,
  getAgentAppointments,
  updateAgentStatus
} = require('../controllers/adminAgentController');

const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require admin access
router.use(protect);
router.use(authorize('admin'));

// Global stats - MUST come before /:agentId routes
router.get('/stats/global', getGlobalAgentStats);

// Agent management routes
router.get('/', getAllAgents);                                    // GET /api/admin/agents
router.get('/:agentId/summary', getAgentSummary);                 // GET /api/admin/agents/:agentId/summary
router.get('/:agentId/referred-users', getAgentReferredUsers);    // GET /api/admin/agents/:agentId/referred-users
router.get('/:agentId/appointments', getAgentAppointments);       // GET /api/admin/agents/:agentId/appointments
router.put('/:agentId/status', updateAgentStatus);                // PUT /api/admin/agents/:agentId/status

module.exports = router;