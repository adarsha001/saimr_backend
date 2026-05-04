// routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllBlogs,
  getSingleBlog,
  getBlogsByAuthor,
  getRelatedBlogs,
  getBlogStats,
  createBlog,
  updateBlog,
  deleteBlog
} = require('../controllers/blogController');

// Import middleware (if you have authentication)
// const { protect, authorize } = require('../middleware/auth');
// const upload = require('../middleware/upload');

// Public routes
router.get('/', getAllBlogs);
router.get('/stats', getBlogStats);
router.get('/author/:authorId', getBlogsByAuthor);
router.get('/:id/related', getRelatedBlogs);
router.get('/:id', getSingleBlog);

// Private routes (require authentication)
// Uncomment the following lines when you have auth middleware
// router.post('/', protect, upload.single('image'), createBlog);
// router.put('/:id', protect, updateBlog);
// router.delete('/:id', protect, deleteBlog);

// For testing without auth (remove in production)
router.post('/', createBlog);
router.put('/:id', updateBlog);
router.delete('/:id', deleteBlog);

module.exports = router;