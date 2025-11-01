// routes/clicks.js
const express = require('express');
const router = express.Router();
const { trackClick } = require('../middleware/clickTracker');

// Public route to track clicks (no authentication required)
router.post('/track', trackClick);

module.exports = router;