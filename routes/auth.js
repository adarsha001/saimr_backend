const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Register User
router.post('/register', async (req, res) => {
  try {
    const { username, name, lastName, userType, phoneNumber, gmail, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: gmail }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    // Create user
    const user = await User.create({
      username,
      name,
      lastName,
      userType,
      phoneNumber,
      gmail,
      password
    });

    // Generate token
    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        isAdmin: user.isAdmin,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    // Check if email/username and password provided
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/username and password'
      });
    }

    // Find user by email or username and include password
    const user = await User.findOne({
      $or: [
        { gmail: emailOrUsername },
        { username: emailOrUsername }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = user.getSignedJwtToken();

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        isAdmin: user.isAdmin,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get Current User
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        isAdmin: user.isAdmin,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update User Profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, lastName, phoneNumber } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, lastName, phoneNumber },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        isAdmin: user.isAdmin,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;