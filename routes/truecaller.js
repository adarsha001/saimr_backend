const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/user');

// In-memory session store (use Redis in production)
const pendingHandshakes = new Map();
const MAX_SESSION_AGE = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute

// Cleanup stale sessions periodically
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, value] of pendingHandshakes.entries()) {
    if (now - value.ts > MAX_SESSION_AGE) {
      pendingHandshakes.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} stale Truecaller sessions`);
  }
}, CLEANUP_INTERVAL);

// Helper function to fetch Truecaller profile
const fetchTruecallerProfile = async (accessToken, endpoint) => {
  try {
    console.log('Fetching Truecaller profile from:', endpoint);
    
    const response = await axios.get(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('Truecaller profile fetched successfully');
    return response.data;
  } catch (error) {
    console.error('Error fetching Truecaller profile:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error('Failed to fetch Truecaller profile');
  }
};

// Helper function to create or update user
const createOrUpdateUser = async (profile, sourceWebsite = 'cleartitle1') => {
  const phoneNumbers = profile.phoneNumbers || [];
  const primaryPhone = phoneNumbers[0]?.toString().replace(/[^\d]/g, '');
  
  if (!primaryPhone) {
    throw new Error('No phone number found in Truecaller profile');
  }

  const name = profile.name || {};
  const firstName = name.first || 'User';
  const lastName = name.last || '';
  const email = profile.onlineIdentities?.email || `${primaryPhone}@truecaller.verified`;
  const avatarUrl = profile.avatarUrl || profile.image || '';

  console.log('Processing user with phone:', primaryPhone);

  let user = await User.findOne({ phoneNumber: primaryPhone });

  if (!user) {
    // Create new user
    let username = `user${primaryPhone.slice(-8)}`;
    let counter = 1;
    
    while (await User.findOne({ username })) {
      username = `user${primaryPhone.slice(-8)}_${counter}`;
      counter++;
    }

    const randomPassword = Math.random().toString(36).slice(-16) + 
                          Math.random().toString(36).slice(-16) +
                          Math.random().toString(36).slice(-16);

    user = new User({
      username,
      name: firstName,
      lastName,
      phoneNumber: primaryPhone,
      gmail: email,
      password: randomPassword,
      isVerified: true,
      verificationDate: new Date(),
      avatar: avatarUrl,
      userType: 'buyer',
      sourceWebsite,
      websiteLogins: {
        [sourceWebsite]: {
          hasLoggedIn: true,
          firstLogin: new Date(),
          lastLogin: new Date(),
          loginCount: 1
        }
      },
      lastLogin: new Date()
    });

    await user.save();
    console.log('New user created:', user.username);
  } else {
    // Update existing user
    console.log('Existing user found:', user.username);
    
    user.lastLogin = new Date();
    user.isVerified = true;
    user.verificationDate = user.verificationDate || new Date();
    
    if (avatarUrl && !user.avatar) {
      user.avatar = avatarUrl;
    }
    
    if (firstName && user.name === 'User') {
      user.name = firstName;
    }
    
    if (lastName && !user.lastName) {
      user.lastName = lastName;
    }

    // Update website login info
    if (!user.websiteLogins) {
      user.websiteLogins = {};
    }
    
    if (!user.websiteLogins[sourceWebsite]) {
      user.websiteLogins[sourceWebsite] = {
        hasLoggedIn: true,
        firstLogin: new Date(),
        lastLogin: new Date(),
        loginCount: 1
      };
    } else {
      user.websiteLogins[sourceWebsite].hasLoggedIn = true;
      user.websiteLogins[sourceWebsite].lastLogin = new Date();
      user.websiteLogins[sourceWebsite].loginCount += 1;
    }

    await user.save();
    console.log('User updated:', user.username);
  }

  return user;
};

// GET /api/auth/truecaller/session/:requestId
router.get('/session/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    console.log('Polling session for requestId:', requestId);
    console.log('Active sessions:', Array.from(pendingHandshakes.keys()));

    const session = pendingHandshakes.get(requestId);

    if (!session) {
      return res.status(404).json({
        ready: false,
        message: 'Session not found or expired'
      });
    }

    if (!session.ready) {
      return res.status(202).json({
        ready: false,
        message: 'Waiting for verification'
      });
    }

    // Session is ready - return token and user data
    const response = {
      ready: true,
      token: session.token,
      user: session.user
    };

    // Mark as consumed but keep for a short time to handle retries
    session.consumed = true;
    
    // Schedule deletion after response is sent
    setTimeout(() => {
      if (pendingHandshakes.get(requestId)?.consumed) {
        pendingHandshakes.delete(requestId);
        console.log('Session consumed and deleted:', requestId);
      }
    }, 5000);

    console.log('Session found and ready for:', requestId);
    res.json(response);
  } catch (error) {
    console.error('Session polling error:', error);
    res.status(500).json({
      ready: false,
      message: 'Internal server error'
    });
  }
});

// POST /api/auth/truecaller/handshake
router.post('/handshake', async (req, res) => {
  try {
    const { requestId } = req.body;
    console.log('Handshake received for requestId:', requestId);
    console.log('Full handshake body:', req.body);

    if (!requestId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing requestId'
      });
    }

    // Store placeholder session
    pendingHandshakes.set(requestId, {
      ready: false,
      ts: Date.now(),
      handshakeReceived: new Date().toISOString()
    });

    console.log('Handshake stored. Active sessions:', pendingHandshakes.size);

    res.status(200).json({
      status: 'acknowledged',
      requestId
    });
  } catch (error) {
    console.error('Handshake error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// POST /api/auth/truecaller/callback
router.post('/callback', async (req, res) => {
  try {
    console.log('Callback received. Body:', JSON.stringify(req.body, null, 2));
    
    const { requestId, accessToken, endpoint } = req.body;

    if (!accessToken || !endpoint) {
      console.error('Missing required fields:', { hasAccessToken: !!accessToken, hasEndpoint: !!endpoint });
      return res.status(400).json({
        success: false,
        error: 'Missing accessToken or endpoint'
      });
    }

    if (!requestId) {
      console.error('Missing requestId in callback');
      return res.status(400).json({
        success: false,
        error: 'Missing requestId'
      });
    }

    // Fetch profile from Truecaller
    console.log('Fetching Truecaller profile...');
    const profile = await fetchTruecallerProfile(accessToken, endpoint);
    
    // Create or update user
    const user = await createOrUpdateUser(profile, 'cleartitle1');
    
    // Generate token and user data
    const token = user.getSignedJwtToken();
    const userData = user.getPublicProfile();

    // Update session with user data
    pendingHandshakes.set(requestId, {
      ready: true,
      token,
      user: userData,
      ts: Date.now(),
      callbackReceived: new Date().toISOString()
    });

    console.log('Callback processed successfully for requestId:', requestId);
    console.log('User verified:', userData.username);

    res.status(200).json({
      success: true,
      message: 'Verification successful'
    });

  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// POST /api/auth/truecaller/manual
router.post('/manual', async (req, res) => {
  try {
    const { phoneNumber, sourceWebsite = 'cleartitle1' } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const cleanPhone = phoneNumber.toString().replace(/[^\d]/g, '');
    
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number'
      });
    }

    console.log('Manual verification for phone:', cleanPhone);

    let user = await User.findOne({ phoneNumber: cleanPhone });

    if (!user) {
      // Create new user for manual verification
      const username = `user${cleanPhone.slice(-8)}`;
      const randomPassword = Math.random().toString(36).slice(-16) + 
                            Math.random().toString(36).slice(-16);

      user = new User({
        username,
        name: 'Manual User',
        phoneNumber: cleanPhone,
        gmail: `${cleanPhone}@manual.verify`,
        password: randomPassword,
        isVerified: true,
        verificationDate: new Date(),
        sourceWebsite,
        userType: 'buyer',
        websiteLogins: {
          [sourceWebsite]: {
            hasLoggedIn: true,
            firstLogin: new Date(),
            lastLogin: new Date(),
            loginCount: 1
          }
        }
      });

      await user.save();
      console.log('New manual user created:', username);
    } else {
      console.log('Existing user found for manual verification:', user.username);
      user.lastLogin = new Date();
      user.isVerified = true;
      
      if (!user.websiteLogins) {
        user.websiteLogins = {};
      }
      
      if (!user.websiteLogins[sourceWebsite]) {
        user.websiteLogins[sourceWebsite] = {
          hasLoggedIn: true,
          firstLogin: new Date(),
          lastLogin: new Date(),
          loginCount: 1
        };
      } else {
        user.websiteLogins[sourceWebsite].lastLogin = new Date();
        user.websiteLogins[sourceWebsite].loginCount += 1;
      }
      
      await user.save();
    }

    const token = user.getSignedJwtToken();
    const userData = user.getPublicProfile();

    res.json({
      success: true,
      token,
      user: userData
    });

  } catch (error) {
    console.error('Manual verification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Verification failed'
    });
  }
});

// GET /api/auth/truecaller/debug/sessions (Development only)
router.get('/debug/sessions', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: 'Not available in production' });
  }
  
  const sessions = Array.from(pendingHandshakes.entries()).map(([id, data]) => ({
    requestId: id,
    ready: data.ready,
    age: Date.now() - data.ts,
    consumed: data.consumed || false,
    handshakeReceived: data.handshakeReceived,
    callbackReceived: data.callbackReceived
  }));
  
  res.json({
    count: sessions.length,
    sessions
  });
});

module.exports = router;