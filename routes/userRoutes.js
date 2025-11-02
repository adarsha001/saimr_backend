const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getUserProfile,
  getUserEnquiries,
  updateUserProfile,
  deleteUserAccount,
  getLikedProperties,
  getPostedProperties
} = require('../controllers/userController');

const {
  likeProperty,
  unlikeProperty,
  checkIfLiked,
  toggleLike
} = require('../controllers/likeController');

// User profile routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/account', protect, deleteUserAccount);

// User enquiries routes
router.get('/my-enquiries', protect, getUserEnquiries);

// User properties routes
router.get('/liked-properties', protect, getLikedProperties);
router.get('/posted-properties', protect, getPostedProperties);

// Like routes
router.post('/like/:propertyId', protect, likeProperty);
router.delete('/like/:propertyId', protect, unlikeProperty);
router.get('/like/:propertyId/check', protect, checkIfLiked);
router.post('/like/:propertyId/toggle', protect, toggleLike);

module.exports = router;