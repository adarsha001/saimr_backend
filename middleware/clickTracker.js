// middleware/clickTracker.js
const ClickAnalytics = require('../models/ClickAnalytics');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

const trackClick = async (req, res, next) => {
  try {
    const {
      itemType,
      itemValue,
      displayName,
      propertyId,
      pageUrl
    } = req.body;

    // Validate required fields
    if (!itemType || !itemValue || !displayName || !pageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: itemType, itemValue, displayName, pageUrl'
      });
    }

    // Validate itemType
    const validTypes = ['phone', 'email', 'instagram', 'twitter', 'facebook', 'linkedin', 'whatsapp', 'website', 'other'];
    if (!validTypes.includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid itemType'
      });
    }

    // Get user IP and geolocation
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    const geo = geoip.lookup(ip);
    
    // Parse user agent
    const parser = new UAParser(req.headers['user-agent']);
    const uaResult = parser.getResult();

    // Create click record
    const clickData = {
      userId: req.user?._id || null,
      sessionId: req.sessionID || req.headers['session-id'] || generateSessionId(),
      itemType,
      itemValue,
      displayName,
      propertyId: propertyId || null,
      pageUrl,
      userAgent: req.headers['user-agent'],
      ipAddress: ip,
      country: geo?.country || 'Unknown',
      city: geo?.city || 'Unknown',
      deviceType: getDeviceType(uaResult)
    };

    const clickRecord = new ClickAnalytics(clickData);
    await clickRecord.save();

    res.json({
      success: true,
      message: 'Click tracked successfully',
      data: { clickId: clickRecord._id }
    });

  } catch (error) {
    console.error('Click tracking error:', error);
    // Don't break the user experience if tracking fails
    res.json({
      success: false,
      message: 'Click tracking failed but action completed'
    });
  }
};

// Helper functions
function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function getDeviceType(uaResult) {
  if (uaResult.device.type === 'mobile') return 'mobile';
  if (uaResult.device.type === 'tablet') return 'tablet';
  return 'desktop';
}

module.exports = { trackClick };