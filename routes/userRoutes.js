const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  updateProfile,
  getLikedProperties,
  getPostedProperties
} = require('../controllers/userController');
const {
  likeProperty,
  unlikeProperty,
  checkIfLiked,
  toggleLike
} = require('../controllers/likeController');

// User routes
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/liked-properties', protect, getLikedProperties);
router.get('/posted-properties', protect, getPostedProperties);

// Like routes
router.post('/like/:propertyId', protect, likeProperty);
router.delete('/like/:propertyId', protect, unlikeProperty);
router.get('/like/:propertyId/check', protect, checkIfLiked);
router.post('/like/:propertyId/toggle', protect, toggleLike);

module.exports = router;