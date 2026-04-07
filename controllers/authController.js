const User = require('../models/user');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');

// Initialize Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// reCAPTCHA v2 Verification Middleware
const verifyCaptcha = async (captchaToken) => {
  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: captchaToken
        }
      }
    );

    console.log('reCAPTCHA v2 Verification:', {
      success: response.data.success,
      timestamp: response.data.challenge_ts,
      hostname: response.data.hostname
    });
    
    return response.data.success;
  } catch (error) {
    console.error("Captcha verification error:", error);
    return false;
  }
};

// Google Sign-In verification
// Google Sign-In verification - Fixed version
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    
    return {
      success: true,
      payload: {
        googleId: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        name: payload.name,
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture
      }
    };
  } catch (error) {
    console.error('Google token verification error:', error);
    return {
      success: false,
      message: 'Invalid Google token'
    };
  }
};


const login = async (req, res) => {
  try {
    const { emailOrUsername, password, sourceWebsite = 'direct' } = req.body;
    
    console.log('Login attempt:', { emailOrUsername, sourceWebsite, body: req.body });

    // Validate email/username and password
    if (!emailOrUsername || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email/username and password'
      });
    }

    // Validate sourceWebsite if provided
    if (sourceWebsite && !['saimgroups', 'cleartitle1', 'direct'].includes(sourceWebsite)) {
      return res.status(400).json({
        success: false,
        message: "Invalid source website"
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

    // Check if user signed up with Google
    if (user.isGoogleAuth) {
      return res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Please sign in with Google.'
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

    // Update sourceWebsite if not already set (for existing users)
    if (sourceWebsite !== 'direct' && (!user.sourceWebsite || user.sourceWebsite === 'direct')) {
      user.sourceWebsite = sourceWebsite;
    }

    // Update individual website login tracking
    if (sourceWebsite === 'saimgroups' || sourceWebsite === 'cleartitle1') {
      const websiteKey = sourceWebsite;
      const now = new Date();
      
      // Initialize if first login to this website
      if (!user.websiteLogins[websiteKey].hasLoggedIn) {
        user.websiteLogins[websiteKey].hasLoggedIn = true;
        user.websiteLogins[websiteKey].firstLogin = now;
      }
      
      // Update tracking for this website
      user.websiteLogins[websiteKey].lastLogin = now;
      user.websiteLogins[websiteKey].loginCount += 1;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token with website info
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
        isAdmin: user.isAdmin,
        isGoogleAuth: user.isGoogleAuth,
        avatar: user.avatar,
        sourceWebsite: user.sourceWebsite,
        // Include website login stats
        websiteLogins: user.websiteLogins,
        // Current website login info
        currentWebsite: sourceWebsite,
        hasLoggedInToCurrentWebsite: sourceWebsite === 'direct' ? null : 
          user.websiteLogins[sourceWebsite]?.hasLoggedIn || false,
        loginCountToCurrentWebsite: sourceWebsite === 'direct' ? null : 
          user.websiteLogins[sourceWebsite]?.loginCount || 0
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
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
      captchaToken,
      sourceWebsite = 'direct'
    } = req.body;

    console.log("Registration attempt for:", username, "from:", sourceWebsite);

    // Validate sourceWebsite if provided
    if (sourceWebsite && !['saimgroups', 'cleartitle1', 'direct'].includes(sourceWebsite)) {
      return res.status(400).json({
        success: false,
        message: "Invalid source website"
      });
    }

    // 1. Verify CAPTCHA first
    if (!captchaToken) {
      return res.status(400).json({
        success: false,
        message: "Please complete the captcha verification"
      });
    }

    const isCaptchaValid = await verifyCaptcha(captchaToken);
    if (!isCaptchaValid) {
      return res.status(400).json({
        success: false,
        message: "Captcha verification failed. Please complete the 'I'm not a robot' check"
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

    // Initialize website logins based on registration source
    const websiteLogins = {
      saimgroups: {
        hasLoggedIn: sourceWebsite === 'saimgroups',
        firstLogin: sourceWebsite === 'saimgroups' ? new Date() : null,
        lastLogin: sourceWebsite === 'saimgroups' ? new Date() : null,
        loginCount: sourceWebsite === 'saimgroups' ? 1 : 0
      },
      cleartitle1: {
        hasLoggedIn: sourceWebsite === 'cleartitle1',
        firstLogin: sourceWebsite === 'cleartitle1' ? new Date() : null,
        lastLogin: sourceWebsite === 'cleartitle1' ? new Date() : null,
        loginCount: sourceWebsite === 'cleartitle1' ? 1 : 0
      }
    };

    // 3. Create user with website tracking
    const user = await User.create({
      username,
      name,
      lastName,
      userType,
      phoneNumber,
      gmail,
      password,
      isGoogleAuth: false,
      sourceWebsite,
      websiteLogins,
      lastLogin: new Date() // Set last login on registration
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
        isAdmin: user.isAdmin,
        isGoogleAuth: user.isGoogleAuth,
        avatar: user.avatar,
        sourceWebsite: user.sourceWebsite,
        websiteLogins: user.websiteLogins,
        currentWebsite: sourceWebsite,
        hasLoggedInToCurrentWebsite: sourceWebsite === 'direct' ? null : true,
        loginCountToCurrentWebsite: sourceWebsite === 'direct' ? null : 1
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    
    let errorMessage = "Error in registration";
    if (error.code === 11000) {
      errorMessage = "Username or email already exists";
    } else if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update user profile (especially for Google users to update phone)
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    console.log('Updating profile for user:', userId);
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Remove fields that shouldn't be updated
    delete updates.password;
    delete updates.gmail;
    delete updates.googleId;
    delete updates.isGoogleAuth;
    delete updates.isAdmin;
    
    // Update user
    Object.keys(updates).forEach(key => {
      user[key] = updates[key];
    });
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail,
        isAdmin: user.isAdmin,
        isGoogleAuth: user.isGoogleAuth,
        avatar: user.avatar,
        requiresPhoneUpdate: user.phoneNumber === '1234567890'
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check if user needs to update phone number
const checkPhoneUpdate = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findById(userId).select('phoneNumber isGoogleAuth');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      requiresPhoneUpdate: user.isGoogleAuth && user.phoneNumber === '1234567890'
    });
  } catch (error) {
    console.error('Check phone update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking phone update status'
    });
  }
};
const googleSignIn = async (req, res) => {
  try {
    const { token, userType } = req.body;

    console.log('Google Sign-In attempt received');
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google token is required"
      });
    }

    // Verify Google token
    const verification = await verifyGoogleToken(token);
    
    if (!verification.success) {
      console.error('Google token verification failed:', verification.message);
      return res.status(400).json({
        success: false,
        message: verification.message || "Google authentication failed"
      });
    }

    const { payload } = verification;
    
    // Check if email is verified by Google
    if (!payload.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email not verified by Google"
      });
    }

    console.log('Google user verified:', payload.email);
    
    // Check if user exists with this Google ID or email
    let user = await User.findOne({
      $or: [
        { googleId: payload.googleId },
        { gmail: payload.email.toLowerCase() }
      ]
    });

    if (user) {
      console.log('Existing user found:', user.gmail);
      
      // User exists, check authentication method
      if (user.googleId !== payload.googleId) {
        // Email exists but with different auth method
        if (!user.isGoogleAuth) {
          return res.status(400).json({
            success: false,
            message: "This email is already registered with password. Please use email/password login."
          });
        }
        // Update Google ID if missing
        user.googleId = payload.googleId;
      }
      
      // Update user information
      user.avatar = payload.picture;
      user.emailVerified = true;
      user.lastLogin = new Date();
      await user.save();
      
    } else {
      console.log('Creating new Google user for:', payload.email);
      
      // Create new user from Google data
      // Generate username from email
      const baseUsername = payload.email.split('@')[0];
      let username = baseUsername;
      let counter = 1;
      
      // Ensure unique username
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      
      // Split name into first and last name
      const nameParts = payload.name ? payload.name.split(' ') : ['User', ''];
      const firstName = nameParts[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      user = await User.create({
        googleId: payload.googleId,
        gmail: payload.email.toLowerCase(),
        name: firstName,
        lastName: lastName,
        username: username,
        userType: userType || 'buyer',
        phoneNumber: '1234567890', // Dummy phone number
        isGoogleAuth: true,
        emailVerified: true,
        avatar: payload.picture,
        lastLogin: new Date()
      });
      
      console.log('New Google user created:', user.gmail);
    }

    // Generate token
    const authToken = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      message: "Google sign-in successful",
      token: authToken,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        userType: user.userType,
        phoneNumber: user.phoneNumber,
        gmail: user.gmail,
        isAdmin: user.isAdmin,
        isGoogleAuth: user.isGoogleAuth,
        avatar: user.avatar,
        requiresPhoneUpdate: user.phoneNumber === '1234567890'
      }
    });
  } catch (error) {
    console.error('Google sign-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Error in Google sign-in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


const verifyTruecaller = async (req, res) => {
  try {
    const { verificationToken, phoneNumber, firstName, lastName, email, sourceWebsite } = req.body;

    console.log("📞 Truecaller verification request received");
    console.log("Has token:", !!verificationToken);
    console.log("Has phone:", !!phoneNumber);

    let cleanPhone = null;
    let userName = null;
    let userLastName = null;
    let userEmail = null;

    // If token provided, decode it
    if (verificationToken) {
      try {
        // Decode JWT token (no verification needed for decoding)
        const decoded = jwt.decode(verificationToken);
        console.log("Decoded token:", JSON.stringify(decoded, null, 2));
        
        cleanPhone = decoded?.phone_number || decoded?.phoneNumber || decoded?.mobile;
        userName = decoded?.given_name || decoded?.firstName || decoded?.name;
        userLastName = decoded?.family_name || decoded?.lastName;
        userEmail = decoded?.email;
        
      } catch (error) {
        console.error("Token decode error:", error);
      }
    } else if (phoneNumber) {
      // Manual phone number entry
      cleanPhone = phoneNumber;
      userName = firstName || 'User';
      userLastName = lastName || '';
      userEmail = email || `${phoneNumber}@manual.entry`;
    }

    // Validate phone number
    if (!cleanPhone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number is required' 
      });
    }

    // Clean phone number (remove non-digits)
    const finalPhone = cleanPhone.toString().replace(/[^\d]/g, '');
    
    if (finalPhone.length < 10) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid phone number format' 
      });
    }

    const website = sourceWebsite || 'cleartitle1';
    
    // Find or create user
    let user = await User.findOne({ phoneNumber: finalPhone });
    
    if (!user) {
      // Generate unique username
      let username = `user_${finalPhone.slice(-8)}`;
      let counter = 1;
      
      while (await User.findOne({ username })) {
        username = `user_${finalPhone.slice(-8)}_${counter}`;
        counter++;
      }
      
      // Create new user
      const userData = {
        username: username,
        name: userName || 'Truecaller User',
        lastName: userLastName || '',
        phoneNumber: finalPhone,
        gmail: userEmail || `${finalPhone}@truecaller.verified`,
        password: Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16),
        isVerified: true,
        verificationDate: new Date(),
        sourceWebsite: website,
        userType: 'buyer',
        websiteLogins: {
          [website]: { 
            hasLoggedIn: true, 
            firstLogin: new Date(), 
            lastLogin: new Date(), 
            loginCount: 1 
          }
        }
      };
      
      user = new User(userData);
      await user.save();
      console.log("✅ New user created:", user._id, username);
      
    } else {
      // Update existing user
      user.lastLogin = new Date();
      user.isVerified = true;
      
      if (!user.websiteLogins) {
        user.websiteLogins = {};
      }
      
      if (!user.websiteLogins[website]) {
        user.websiteLogins[website] = {
          hasLoggedIn: false,
          firstLogin: new Date(),
          lastLogin: new Date(),
          loginCount: 0
        };
      }
      
      user.websiteLogins[website].hasLoggedIn = true;
      user.websiteLogins[website].lastLogin = new Date();
      user.websiteLogins[website].loginCount += 1;
      
      await user.save();
      console.log("✅ User updated:", user._id);
    }

    // Generate JWT token
    const token = user.getSignedJwtToken();
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.gmail,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
        isVerified: user.isVerified
      }
    });
    
  } catch (error) {
    console.error("❌ Truecaller verification error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    });
  }
};


module.exports = {
  register,
  login,
  googleSignIn,
  updateProfile,
  checkPhoneUpdate,verifyTruecaller
};