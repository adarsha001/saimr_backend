const express = require('express');
const router = express.Router();
const {
  getUserById,
  getAllUsers
} = require('../controllers/admincleaetitleController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require admin access
router.use(protect);
router.use(authorize('admin'));
// Routes
router.get('/users', getAllUsers);
router.get('/clear/users/:id', getUserById);

module.exports = router;