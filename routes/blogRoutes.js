const express = require('express');
const router = express.Router();
const upload = require('../middlewares/multer'); // Your existing multer config
const {
  createBlog

} = require('../controllers/blogController');

// Public routes
router.get('/', createBlog);


module.exports = router;