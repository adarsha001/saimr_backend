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


// truecallerController.js



const pendingHandshakes = new Map();

// TC calls this when user taps Continue
// Body: { requestId, accessToken, endpoint }
const handleTruecallerCallback = async (req, res) => {
  try {
    const { requestId, accessToken, endpoint } = req.body;

    if (!accessToken || !endpoint) {
      return res.status(400).json({ success: false });
    }

    // Use the endpoint TC gives you — NOT a hardcoded one
    const profile = await fetchTruecallerProfile(accessToken, endpoint);

    const phoneNumbers = profile.phoneNumbers || [];
    const primaryPhone = phoneNumbers[0]?.toString().replace(/[^\d]/g, '');

    if (!primaryPhone) {
      return res.status(400).json({ success: false, message: 'No phone in profile' });
    }

    const name = profile.name || {};
    const firstName = name.first || 'User';
    const lastName = name.last || '';
    const email = profile.onlineIdentities?.email || null;
    const avatarUrl = profile.avatarUrl || '';

    let user = await User.findOne({ phoneNumber: primaryPhone });

    if (!user) {
      let username = `user_${primaryPhone.slice(-8)}`;
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `user_${primaryPhone.slice(-8)}_${counter++}`;
      }
      user = new User({
        username,
        name: firstName,
        lastName,
        phoneNumber: primaryPhone,
        gmail: email || `${primaryPhone}@truecaller.verified`,
        password: Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16),
        isVerified: true,
        verificationDate: new Date(),
        avatar: avatarUrl,
        userType: 'buyer',
        sourceWebsite: 'cleartitle1',
        websiteLogins: {
          cleartitle1: { hasLoggedIn: true, firstLogin: new Date(), lastLogin: new Date(), loginCount: 1 }
        }
      });
      await user.save();
    } else {
      user.lastLogin = new Date();
      user.isVerified = true;
      if (avatarUrl && !user.avatar) user.avatar = avatarUrl;
      if (!user.websiteLogins) user.websiteLogins = {};
      if (!user.websiteLogins.cleartitle1) {
        user.websiteLogins.cleartitle1 = { hasLoggedIn: false, firstLogin: new Date(), lastLogin: new Date(), loginCount: 0 };
      }
      user.websiteLogins.cleartitle1.hasLoggedIn = true;
      user.websiteLogins.cleartitle1.lastLogin = new Date();
      user.websiteLogins.cleartitle1.loginCount += 1;
      await user.save();
    }

    // Store a short-lived session keyed by requestId
    // so the frontend can poll for it
    pendingHandshakes.set(requestId, {
      token: user.getSignedJwtToken(),
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.gmail,
        phoneNumber: user.phoneNumber,
        userType: user.userType,
        isVerified: user.isVerified,
        avatar: user.avatar
      },
      ts: Date.now()
    });

    // Clean stale entries (> 5 min)
    for (const [k, v] of pendingHandshakes) {
      if (Date.now() - v.ts > 300000) pendingHandshakes.delete(k);
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('TC callback error:', error.message);
    res.status(500).json({ success: false });
  }
};

// Frontend polls this after launching TC deep link
const pollSession = async (req, res) => {
  const { requestId } = req.params;
  const session = pendingHandshakes.get(requestId);

  if (!session) {
    return res.status(404).json({ ready: false });
  }

  pendingHandshakes.delete(requestId); // consume once
  res.json({ ready: true, token: session.token, user: session.user });
};

// Handshake acknowledgment (TC sends this first)
const handleHandshake = async (req, res) => {
  console.log('Handshake:', req.body.requestId);
  res.status(200).json({ status: 'acknowledged' });
};

const fetchTruecallerProfile = async (accessToken, endpoint) => {
  const response = await axios.get(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Cache-Control': 'no-cache' }
  });
  return response.data;
};

// Manual fallback
const manualVerification = async (req, res) => {
  try {
    const { phoneNumber, sourceWebsite } = req.body;
    const cleanPhone = phoneNumber.toString().replace(/[^\d]/g, '');
    let user = await User.findOne({ phoneNumber: cleanPhone });
    if (!user) {
      user = new User({
        username: `user_${cleanPhone.slice(-8)}`,
        name: 'Manual User',
        phoneNumber: cleanPhone,
        gmail: `${cleanPhone}@manual.verify`,
        password: Math.random().toString(36).slice(-16),
        isVerified: true,
        sourceWebsite: sourceWebsite || 'cleartitle1',
        userType: 'buyer',
      });
      await user.save();
    }
    res.json({ success: true, token: user.getSignedJwtToken(), user: { id: user._id, name: user.name, phoneNumber: user.phoneNumber } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
  register,
  login,
  googleSignIn,
  updateProfile,
  checkPhoneUpdate, handleHandshake, handleTruecallerCallback, pollSession, manualVerification 
};