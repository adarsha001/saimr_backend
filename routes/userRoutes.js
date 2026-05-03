// routes/user.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const upload = require("../middlewares/multer");
const {
  getUserProfile,
  getUserEnquiries,
  updateUserProfile,
  deleteUserAccount,
  getLikedProperties,
  getPostedProperties,
  uploadAvatar,
  applyForAgentStatus,
  checkAgentStatus,changePassword,
} = require('../controllers/userController');
const {
  getAgentProfile,
  getReferralInfo,
  scheduleAppointment,
  getAppointments,
  updateAppointmentStatus,
  getReferralStats,
  getDashboardStats
} = require('../controllers/agentController');

const {
  likeProperty,
  unlikeProperty,
  checkIfLiked,
  toggleLike
} = require('../controllers/likeController');

// User profile routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

router.post('/change-password', protect, changePassword);
router.delete('/account', protect, deleteUserAccount);

// User enquiries routes
router.get('/my-enquiries', protect, getUserEnquiries);
router.post('/apply-agent', protect, applyForAgentStatus);
router.get('/check-agent-status', protect, checkAgentStatus );
// User properties routes

router.get('/profile', getAgentProfile);
router.get('/dashboard', getDashboardStats);

// Referral routes
router.get('/referral-info', getReferralInfo);
router.get('/referral-stats', getReferralStats);

// Appointment routes
router.post('/appointments', scheduleAppointment);
router.get('/appointments', getAppointments);
router.put('/appointments/:appointmentId', updateAppointmentStatus);
// Avatar upload route
router.post('/upload-avatar', protect, upload.single('avatar'), uploadAvatar);

router.use(protect);
router.post('/like/:propertyId', likeProperty);
router.delete('/like/:propertyId', unlikeProperty);
router.get('/like/:propertyId/check', checkIfLiked);
router.post('/like/:propertyId/toggle', toggleLike);
router.get('/liked-properties', getLikedProperties);

router.get('/posted-properties', getPostedProperties);
module.exports = router;