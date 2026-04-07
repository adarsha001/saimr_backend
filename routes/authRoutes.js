const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const { 
  register, 
  login, 
  googleSignIn, 
  updateProfile, 
  checkPhoneUpdate, 
  verifyTruecaller,
  verifyTruecallerProfile,
  handleHandshake,
  manualVerification
} = require('../controllers/authController');

const { createEnquiry } = require('../controllers/enquiryController');
const { protect } = require('../middleware/authMiddleware');
const detectWebsite = require('../middleware/detectWebsite');

router.use(detectWebsite);

/* ================= RATE LIMITERS ================= */

// Strict limiter for login (prevent brute force)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  message: "Too many login attempts. Try again later."
});

// Moderate limiter for register
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many accounts created. Try again later."
});

// Google auth limiter (avoid abuse)
const googleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests. Try again later."
});

// Enquiry limiter (prevent spam leads)
const enquiryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many enquiries sent. Please wait."
});

// General fallback limiter (optional)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100
});

/* ================= ROUTES ================= */

// Public routes
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);

router.post('/google', googleLimiter, googleSignIn);
router.post('/google-login', googleLimiter, googleSignIn);
router.post('/google-signin', googleLimiter, googleSignIn);
// Truecaller handshake acknowledgment endpoint
router.post('/api/auth/truecaller/handshake', handleHandshake);
router.post('/api/auth/truecaller/callback', handleTruecallerCallback); // ← TC posts token here
router.get('/api/auth/truecaller/session/:requestId', pollSession);     // ← frontend polls here
router.post('/api/auth/truecaller/manual', manualVerification);

router.post('/enquiries', enquiryLimiter, createEnquiry);

router.get('/check-phone', apiLimiter, protect, checkPhoneUpdate);

module.exports = router;