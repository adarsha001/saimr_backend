const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { createEnquiry } = require('../controllers/enquiryController');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Enquiry route (public - anyone can submit an enquiry)
router.post('/enquiries', createEnquiry);

module.exports = router;