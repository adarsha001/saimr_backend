const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  googleSignIn, 
  updateProfile, 
  checkPhoneUpdate 
} = require('../controllers/authController');
const { createEnquiry } = require('../controllers/enquiryController');
const { protect } = require('../middleware/authMiddleware');
// Public routes
const detectWebsite = require('../middleware/detectWebsite');
router.use(detectWebsite);
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleSignIn);

// Protected routes

router.get('/check-phone', protect, checkPhoneUpdate);
// Enquiry route (public - anyone can submit an enquiry)
router.post('/enquiries', createEnquiry);

module.exports = router;