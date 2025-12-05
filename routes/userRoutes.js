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
  uploadAvatar
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

router.get('/posted-properties', protect, getPostedProperties);

// Avatar upload route
router.post('/upload-avatar', protect, upload.single('avatar'), uploadAvatar);

router.use(protect);
router.post('/like/:propertyId', likeProperty);
router.delete('/like/:propertyId', unlikeProperty);
router.get('/like/:propertyId/check', checkIfLiked);
router.post('/like/:propertyId/toggle', toggleLike);
router.get('/liked-properties', getLikedProperties);
module.exports = router;