const ClickAnalytics = require('../models/ClickAnalytics');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const trackClick = async (req, res, next) => {
  // Only handle POST requests to track clicks
  if (req.method !== 'POST' || !req.path.includes('/track')) {
    return next();
  }

  try {
    const {
      itemType,
      itemValue,
      displayName,
      propertyId,
      pageUrl,
      userAgent,
      timestamp,
      sessionId,
      userId,
      userName
    } = req.body;

    console.log('📥 Received click tracking request:', {
      itemType,
      itemValue,
      displayName,
      userId,
      userName,
      sessionId
    });

    // Validate required fields
    if (!itemType || !itemValue || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: itemType, itemValue, displayName'
      });
    }

    // Validate itemType against enum values
    const validTypes = ['phone', 'email', 'instagram', 'twitter', 'facebook', 'linkedin', 'whatsapp', 'website', 'location', 'other'];
    if (!validTypes.includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid itemType. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Get user IP and geolocation
    const ip = req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress || 
               req.connection.socket?.remoteAddress ||
               'unknown';
    
    // Clean IP address (remove IPv6 prefix if present)
    const cleanIp = ip.replace(/^::ffff:/, '');
    const geo = geoip.lookup(cleanIp);
    
    // Parse user agent
    const parser = new UAParser(userAgent || req.headers['user-agent']);
    const uaResult = parser.getResult();

    // Create click record with user information
    const clickData = {
      userId: userId || null,
      userName: userName || null,
      sessionId: sessionId || generateSessionId(),
      itemType,
      itemValue,
      displayName: displayName || itemValue,
      propertyId: propertyId || null,
      pageUrl: pageUrl || req.headers.referer || 'unknown',
      userAgent: userAgent || req.headers['user-agent'],
      ipAddress: cleanIp,
      country: geo?.country || 'Unknown',
      city: geo?.city || 'Unknown',
      deviceType: getDeviceType(uaResult),
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    console.log('💾 Saving click record:', {
      userId: clickData.userId,
      userName: clickData.userName,
      itemType: clickData.itemType,
      displayName: clickData.displayName
    });

    const clickRecord = new ClickAnalytics(clickData);
    await clickRecord.save();

    console.log('✅ Click tracked successfully:', clickRecord._id);

    res.json({
      success: true,
      message: 'Click tracked successfully',
      data: { 
        clickId: clickRecord._id,
        sessionId: clickData.sessionId,
        userId: clickData.userId,
        userName: clickData.userName
      }
    });

  } catch (error) {
    console.error('❌ Click tracking error:', error);
    // Don't break the user experience if tracking fails
    res.status(500).json({
      success: false,
      message: 'Click tracking failed but action completed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper functions
function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function getDeviceType(uaResult) {
  if (uaResult.device.type === 'mobile') return 'mobile';
  if (uaResult.device.type === 'tablet') return 'tablet';
  return 'desktop';
}

module.exports = { trackClick };