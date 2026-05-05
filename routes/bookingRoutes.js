// routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  bookAppointment,
  getUserAppointments,
  getAgentAppointments,
  updateAppointmentStatus,
  cancelAppointment
} = require('../controllers/bookingController');

// User routes
router.post('/appointments', protect, bookAppointment);
router.get('/appointments/my', protect, getUserAppointments);
router.delete('/appointments/:appointmentId', protect, cancelAppointment);

// Agent routes
router.get('/agent/appointments', protect, getAgentAppointments);
router.put('/appointments/:appointmentId/status', protect, updateAppointmentStatus);

module.exports = router;