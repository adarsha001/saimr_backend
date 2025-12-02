const User = require('../models/user');
const axios = require('axios'); 
// reCAPTCHA Verification Middleware
const verifyCaptcha = async (captchaToken) => {
  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret:env.RECAPTCHA_SECRET_KEY, // Your Secret Key
          response: captchaToken
        }
      }
    );

    return response.data.success && response.data.score >= 0.5;
  } catch (error) {
    console.error("Captcha verification error:", error);
    return false;
  }
};

// Register user
const register = async (req, res) => {
  try {
    const { 
      username, 
      name, 
      lastName, 
      userType, 
      phoneNumber, 
      gmail, 
      password,
      captchaToken 
    } = req.body;

    // 1. Verify CAPTCHA first
    const isCaptchaValid = await verifyCaptcha(captchaToken);
    if (!isCaptchaValid) {
      return res.status(400).json({
        success: false,
        message: "Captcha verification failed. Please try again."
      });
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ gmail }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or username"
      });
    }

    // 3. Create user
    const user = await User.create({
      username,
      name,
      lastName,
      userType,
      phoneNumber,
      gmail,
      password
    });

    // 4. Generate token
    const token = user.getSignedJwtToken();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error in registration",
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    // Validate email/username and password
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/username and password'
      });
    }

    // Find user by email or username
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
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error in login',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login
};