const ClickAnalytics = require('../models/ClickAnalytics');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

// Track click function
exports.trackClick = async (req, res) => {
  try {
    const {
      itemType,
      itemValue,
      displayName,
      propertyId,
      pageUrl,
      userAgent,
      page,
      timestamp,
      sessionId
    } = req.body;

    console.log('📥 Received click data:', { itemType, itemValue, displayName });

    // Validate required fields
    if (!itemType || !itemValue) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: itemType, itemValue'
      });
    }

    // Get user IP and geolocation
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const geo = geoip.lookup(ip);
    
    // Parse user agent
    const parser = new UAParser(userAgent || req.headers['user-agent']);
    const uaResult = parser.getResult();

    // Create click record
    const clickData = {
      sessionId: sessionId || generateSessionId(),
      itemType,
      itemValue,
      displayName: displayName || itemValue,
      propertyId: propertyId || null,
      pageUrl: pageUrl || page || req.headers.referer || 'unknown',
      userAgent: userAgent || req.headers['user-agent'],
      ipAddress: ip,
      country: geo?.country || 'Unknown',
      city: geo?.city || 'Unknown',
      deviceType: getDeviceType(uaResult),
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const clickRecord = new ClickAnalytics(clickData);
    await clickRecord.save();

    console.log('✅ Click tracked successfully:', clickRecord._id);

    res.json({
      success: true,
      message: 'Click tracked successfully',
      data: { 
        clickId: clickRecord._id,
        sessionId: clickData.sessionId
      }
    });

  } catch (error) {
    console.error('❌ Click tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Click tracking failed'
    });
  }
};

// Get complete click analytics
// Get complete click analytics
exports.getClickAnalytics = async (req, res) => {
  try {
    console.log('📊 Backend: Fetching click analytics');
    
    const { timeframe = '7d', type, propertyId, includeRawData = 'false', limit = 100 } = req.query;
    
    // Calculate date range
    const dateRange = calculateDateRange(timeframe);
    
    // Build match query
    const matchQuery = {
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    };
    
    if (type) matchQuery.itemType = type;
    if (propertyId) matchQuery.propertyId = propertyId;

    console.log('🔍 Match query:', matchQuery);

    // Get summary stats
    const summary = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' },
          uniqueUsers: { $addToSet: '$ipAddress' },
          uniqueSessions: { $addToSet: '$sessionId' },
          countries: { $addToSet: '$country' },
          cities: { $addToSet: '$city' },
          deviceTypes: { $addToSet: '$deviceType' },
          itemTypes: { $addToSet: '$itemType' }
        }
      },
      {
        $project: {
          totalClicks: 1,
          uniqueItemsCount: { $size: '$uniqueItems' },
          uniqueUsersCount: { $size: '$uniqueUsers' },
          uniqueSessionsCount: { $size: '$uniqueSessions' },
          countriesCount: { $size: '$countries' },
          citiesCount: { $size: '$cities' },
          deviceTypesCount: { $size: '$deviceTypes' },
          itemTypesCount: { $size: '$itemTypes' },
          avgClicksPerItem: { 
            $cond: [
              { $eq: [{ $size: '$uniqueItems' }, 0] },
              0,
              { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
            ]
          },
          avgClicksPerSession: {
            $cond: [
              { $eq: [{ $size: '$uniqueSessions' }, 0] },
              0,
              { $divide: ['$totalClicks', { $size: '$uniqueSessions' }] }
            ]
          }
        }
      }
    ]);

    // Get clicks by type
    const clicksByType = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' },
          uniqueUsers: { $addToSet: '$ipAddress' }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalClicks: 1,
          uniqueItemsCount: { $size: '$uniqueItems' },
          uniqueUsersCount: { $size: '$uniqueUsers' },
          avgClicksPerItem: {
            $cond: [
              { $eq: [{ $size: '$uniqueItems' }, 0] },
              0,
              { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
            ]
          }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    // Get popular clicks
    const popularClicks = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            itemType: '$itemType',
            itemValue: '$itemValue',
            displayName: '$displayName'
          },
          clickCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$ipAddress' },
          lastClicked: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          itemType: '$_id.itemType',
          itemValue: '$_id.itemValue',
          displayName: '$_id.displayName',
          clickCount: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' },
          lastClicked: 1
        }
      },
      { $sort: { clickCount: -1 } },
      { $limit: 10 }
    ]);

    // Get daily trends
    const dailyTrends = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$ipAddress' }
        }
      },
      {
        $project: {
          date: '$_id',
          clicks: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get geographic data
    const geographicData = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            country: '$country',
            city: '$city'
          },
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$ipAddress' }
        }
      },
      {
        $project: {
          country: '$_id.country',
          city: '$_id.city',
          clicks: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { clicks: -1 } },
      { $limit: 20 }
    ]);

    // Get device data
    const deviceData = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$deviceType',
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$ipAddress' }
        }
      },
      {
        $project: {
          deviceType: '$_id',
          clicks: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { clicks: -1 } }
    ]);

    // Get hourly distribution
    const hourlyDistribution = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $hour: '$timestamp'
          },
          clicks: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          hour: '$_id',
          clicks: 1,
          uniqueSessionsCount: { $size: '$uniqueSessions' }
        }
      },
      { $sort: { hour: 1 } }
    ]);

    // Get raw data if requested
    let rawData = [];
    if (includeRawData === 'true') {
      rawData = await ClickAnalytics.find(matchQuery)
        .select('-__v -updatedAt')
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    const responseData = {
      summary: summary[0] || {
        totalClicks: 0,
        uniqueItemsCount: 0,
        uniqueUsersCount: 0,
        uniqueSessionsCount: 0,
        countriesCount: 0,
        citiesCount: 0,
        deviceTypesCount: 0,
        itemTypesCount: 0,
        avgClicksPerItem: 0,
        avgClicksPerSession: 0
      },
      clicksByType,
      popularClicks,
      dailyTrends,
      geographicData,
      deviceData,
      hourlyDistribution,
      timeframe,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end
      }
    };

    // Only include raw data if requested
    if (includeRawData === 'true') {
      responseData.rawData = rawData;
    }

    console.log('✅ Backend: Analytics data fetched successfully');
    
    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Backend: Get click analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click analytics',
      error: error.message
    });
  }
};

// Get detailed raw click data with pagination
exports.getRawClickData = async (req, res) => {
  try {
    const { 
      timeframe = '7d', 
      type, 
      propertyId, 
      page = 1, 
      limit = 50,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      search
    } = req.query;

    const dateRange = calculateDateRange(timeframe);
    const matchQuery = {
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    };
    
    if (type) matchQuery.itemType = type;
    if (propertyId) matchQuery.propertyId = propertyId;
    
    // Add search functionality
    if (search) {
      matchQuery.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { itemValue: { $regex: search, $options: 'i' } },
        { itemType: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [data, total] = await Promise.all([
      ClickAnalytics.find(matchQuery)
        .select('-__v -updatedAt')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      ClickAnalytics.countDocuments(matchQuery)
    ]);

    // Get summary for the current filter
    const filterSummary = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$ipAddress' },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        clicks: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        summary: filterSummary[0] || {
          totalClicks: 0,
          uniqueUsersCount: 0,
          uniqueSessionsCount: 0
        },
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        },
        filters: {
          timeframe,
          type,
          propertyId,
          search
        }
      }
    });

  } catch (error) {
    console.error('Get raw click data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch raw click data'
    });
  }
};

// Get user sessions with click details
exports.getUserSessions = async (req, res) => {
  try {
    const { timeframe = '7d', limit = 50 } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const sessions = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: '$sessionId',
          userId: { $first: '$userId' },
          ipAddress: { $first: '$ipAddress' },
          country: { $first: '$country' },
          city: { $first: '$city' },
          deviceType: { $first: '$deviceType' },
          userAgent: { $first: '$userAgent' },
          firstActivity: { $min: '$timestamp' },
          lastActivity: { $max: '$timestamp' },
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' },
          itemTypes: { $addToSet: '$itemType' },
          pageUrls: { $addToSet: '$pageUrl' },
          clicks: {
            $push: {
              itemType: '$itemType',
              itemValue: '$itemValue',
              displayName: '$displayName',
              timestamp: '$timestamp',
              pageUrl: '$pageUrl'
            }
          }
        }
      },
      {
        $project: {
          sessionId: '$_id',
          userId: 1,
          ipAddress: 1,
          location: {
            country: '$country',
            city: '$city'
          },
          deviceType: 1,
          userAgent: 1,
          sessionDuration: {
            $divide: [
              { $subtract: ['$lastActivity', '$firstActivity'] },
              1000 * 60 // Convert to minutes
            ]
          },
          totalClicks: 1,
          uniqueItemsCount: { $size: '$uniqueItems' },
          itemTypesCount: { $size: '$itemTypes' },
          pageUrlsCount: { $size: '$pageUrls' },
          clicksPerMinute: {
            $cond: [
              { $eq: [{ $subtract: ['$lastActivity', '$firstActivity'] }, 0] },
              0,
              {
                $divide: [
                  '$totalClicks',
                  { $divide: [{ $subtract: ['$lastActivity', '$firstActivity'] }, 1000 * 60] }
                ]
              }
            ]
          },
          firstActivity: 1,
          lastActivity: 1,
          clicks: { $slice: ['$clicks', 10] } // Limit to last 10 clicks
        }
      },
      { $sort: { lastActivity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        timeframe,
        dateRange,
        totalSessions: sessions.length
      }
    });

  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user sessions'
    });
  }
};

// Export click data to various formats
exports.exportClickData = async (req, res) => {
  try {
    const { timeframe = '7d', format = 'json', type, propertyId } = req.query;
    const dateRange = calculateDateRange(timeframe);
    
    const matchQuery = {
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    };
    
    if (type) matchQuery.itemType = type;
    if (propertyId) matchQuery.propertyId = propertyId;

    const data = await ClickAnalytics.find(matchQuery)
      .select('-__v -updatedAt')
      .sort({ timestamp: -1 })
      .lean();

    if (format === 'csv') {
      // Convert to CSV
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=click-analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    } else if (format === 'excel') {
      // For Excel, you would use a library like exceljs
      // This is a simplified version
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=click-analytics-${timeframe}-${new Date().toISOString().split('T')[0]}.xlsx`);
      // In practice, you'd generate Excel file here
      return res.json({
        success: true,
        message: 'Excel export would be generated here',
        data: data
      });
    } else {
      // Default JSON
      res.json({
        success: true,
        data: {
          metadata: {
            exportedAt: new Date(),
            timeframe,
            totalRecords: data.length,
            dateRange
          },
          clicks: data
        }
      });
    }

  } catch (error) {
    console.error('Export click data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export click data'
    });
  }
};

// Helper functions
function getDeviceType(uaResult) {
  if (uaResult.device.type === 'mobile') return 'mobile';
  if (uaResult.device.type === 'tablet') return 'tablet';
  return 'desktop';
}

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function calculateDateRange(timeframe) {
  const now = new Date();
  const start = new Date();

  switch (timeframe) {
    case '24h':
      start.setHours(now.getHours() - 24);
      break;
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2020);
      break;
    default:
      start.setDate(now.getDate() - 7);
  }

  return { start, end: now };
}

function convertToCSV(data) {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(item => 
    Object.values(item).map(field => 
      typeof field === 'string' && field.includes(',') ? `"${field}"` : field
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

// Additional analytics endpoints
exports.getClickStatsByType = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const stats = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' },
          uniqueUsers: { $addToSet: '$ipAddress' },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalClicks: 1,
          itemsCount: { $size: '$uniqueItems' },
          usersCount: { $size: '$uniqueUsers' },
          sessionsCount: { $size: '$uniqueSessions' },
          avgClicksPerItem: {
            $cond: [
              { $eq: [{ $size: '$uniqueItems' }, 0] },
              0,
              { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
            ]
          }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get click stats by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click stats by type'
    });
  }
};

exports.getPopularClicks = async (req, res) => {
  try {
    const { timeframe = '7d', limit = 10 } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const popularClicks = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: {
            itemType: '$itemType',
            itemValue: '$itemValue',
            displayName: '$displayName'
          },
          clickCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$ipAddress' },
          lastClicked: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          itemType: '$_id.itemType',
          itemValue: '$_id.itemValue',
          displayName: '$_id.displayName',
          clickCount: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' },
          lastClicked: 1
        }
      },
      { $sort: { clickCount: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: popularClicks
    });

  } catch (error) {
    console.error('Get popular clicks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular clicks'
    });
  }
};

exports.getClickTrends = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const trends = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          clicks: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id',
          clicks: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Get click trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click trends'
    });
  }
};

// Get complete click analytics
exports.getClickAnalytics = async (req, res) => {
  try {
    console.log('📊 Backend: Fetching click analytics');
    
    const { timeframe = '7d', type, propertyId, includeRawData = 'false', limit = 100 } = req.query;
    
    // Calculate date range
    const dateRange = calculateDateRange(timeframe);
    
    // Build match query
    const matchQuery = {
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    };
    
    if (type) matchQuery.itemType = type;
    if (propertyId) matchQuery.propertyId = propertyId;

    console.log('🔍 Match query:', matchQuery);

    // Get summary stats
    const summary = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' },
          uniqueUsers: { $addToSet: '$ipAddress' },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      },
      {
        $project: {
          totalClicks: 1,
          uniqueItemsCount: { $size: '$uniqueItems' },
          uniqueUsersCount: { $size: '$uniqueUsers' },
          uniqueSessionsCount: { $size: '$uniqueSessions' },
          avgClicksPerItem: { 
            $cond: [
              { $eq: [{ $size: '$uniqueItems' }, 0] },
              0,
              { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
            ]
          }
        }
      }
    ]);

    // Get clicks by type
    const clicksByType = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalClicks: 1,
          uniqueItemsCount: { $size: '$uniqueItems' },
          avgClicksPerItem: {
            $cond: [
              { $eq: [{ $size: '$uniqueItems' }, 0] },
              0,
              { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
            ]
          }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    // Get popular clicks
    const popularClicks = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            itemType: '$itemType',
            itemValue: '$itemValue',
            displayName: '$displayName'
          },
          clickCount: { $sum: 1 },
          lastClicked: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          itemType: '$_id.itemType',
          itemValue: '$_id.itemValue',
          displayName: '$_id.displayName',
          clickCount: 1,
          lastClicked: 1
        }
      },
      { $sort: { clickCount: -1 } },
      { $limit: 10 }
    ]);

    // Get daily trends
    const dailyTrends = await ClickAnalytics.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          clicks: { $sum: 1 },
          uniqueUsers: { $addToSet: '$ipAddress' }
        }
      },
      {
        $project: {
          date: '$_id',
          clicks: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { date: 1 } }
    ]);

    // Get raw data if requested
    let rawData = [];
    if (includeRawData === 'true') {
      rawData = await ClickAnalytics.find(matchQuery)
        .select('-__v -updatedAt')
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();
    }

    const responseData = {
      summary: summary[0] || {
        totalClicks: 0,
        uniqueItemsCount: 0,
        uniqueUsersCount: 0,
        uniqueSessionsCount: 0,
        avgClicksPerItem: 0
      },
      clicksByType,
      popularClicks,
      dailyTrends,
      timeframe,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end
      }
    };

    // Only include raw data if requested
    if (includeRawData === 'true') {
      responseData.rawData = rawData;
    }

    console.log('✅ Backend: Analytics data fetched successfully');
    
    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ Backend: Get click analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click analytics',
      error: error.message // Include error message for debugging
    });
  }
};

// Helper function for date range calculation
function calculateDateRange(timeframe) {
  const now = new Date();
  const start = new Date();

  switch (timeframe) {
    case '24h':
      start.setHours(now.getHours() - 24);
      break;
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
      start.setFullYear(2020);
      break;
    default:
      start.setDate(now.getDate() - 7);
  }

  return { start, end: now };
}

// Other controller functions...
exports.getClickStatsByType = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const stats = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: '$itemType',
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' }
        }
      },
      {
        $project: {
          itemType: '$_id',
          totalClicks: 1,
          itemsCount: { $size: '$uniqueItems' },
          avgClicksPerItem: {
            $cond: [
              { $eq: [{ $size: '$uniqueItems' }, 0] },
              0,
              { $divide: ['$totalClicks', { $size: '$uniqueItems' }] }
            ]
          }
        }
      },
      { $sort: { totalClicks: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get click stats by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click stats by type'
    });
  }
};

exports.getPopularClicks = async (req, res) => {
  try {
    const { timeframe = '7d', limit = 10 } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const popularClicks = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: {
            itemType: '$itemType',
            itemValue: '$itemValue',
            displayName: '$displayName'
          },
          clickCount: { $sum: 1 },
          lastClicked: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          itemType: '$_id.itemType',
          itemValue: '$_id.itemValue',
          displayName: '$_id.displayName',
          clickCount: 1,
          lastClicked: 1
        }
      },
      { $sort: { clickCount: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: popularClicks
    });

  } catch (error) {
    console.error('Get popular clicks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch popular clicks'
    });
  }
};

exports.getClickTrends = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const trends = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$timestamp'
            }
          },
          clicks: { $sum: 1 }
        }
      },
      {
        $project: {
          date: '$_id',
          clicks: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    console.error('Get click trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch click trends'
    });
  }
};

// Add these simplified versions for now
exports.getRawClickData = async (req, res) => {
  try {
    const { timeframe = '7d', page = 1, limit = 50 } = req.query;
    const dateRange = calculateDateRange(timeframe);
    
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const data = await ClickAnalytics.find({
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    })
    .select('-__v -updatedAt')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

    const total = await ClickAnalytics.countDocuments({
      timestamp: { $gte: dateRange.start, $lte: dateRange.end }
    });

    res.json({
      success: true,
      data: {
        clicks: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Get raw click data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch raw click data'
    });
  }
};

exports.getUserSessions = async (req, res) => {
  try {
    const { timeframe = '7d', limit = 50 } = req.query;
    const dateRange = calculateDateRange(timeframe);

    const sessions = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end } 
        } 
      },
      {
        $group: {
          _id: '$sessionId',
          ipAddress: { $first: '$ipAddress' },
          country: { $first: '$country' },
          city: { $first: '$city' },
          deviceType: { $first: '$deviceType' },
          firstActivity: { $min: '$timestamp' },
          lastActivity: { $max: '$timestamp' },
          totalClicks: { $sum: 1 },
          uniqueItems: { $addToSet: '$itemValue' }
        }
      },
      {
        $project: {
          sessionId: '$_id',
          ipAddress: 1,
          location: {
            country: '$country',
            city: '$city'
          },
          deviceType: 1,
          sessionDuration: {
            $divide: [
              { $subtract: ['$lastActivity', '$firstActivity'] },
              1000 * 60 // Convert to minutes
            ]
          },
          totalClicks: 1,
          uniqueItemsCount: { $size: '$uniqueItems' },
          firstActivity: 1,
          lastActivity: 1
        }
      },
      { $sort: { lastActivity: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        timeframe,
        totalSessions: sessions.length
      }
    });

  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user sessions'
    });
  }
};

exports.exportClickData = async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Export feature coming soon',
      data: []
    });
  } catch (error) {
    console.error('Export click data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export click data'
    });
  }
};

// Add this function to your clickController.js
exports.getHourlyDistribution = async (req, res) => {
  try {
    const { timeframe = '7d', groupBy = 'hour' } = req.query;
    
    console.log('🕒 Fetching hourly distribution for timeframe:', timeframe);
    
    // Calculate date range
    const dateRange = calculateDateRange(timeframe);
    
    const hourlyDistribution = await ClickAnalytics.aggregate([
      { 
        $match: { 
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        } 
      },
      {
        $group: {
          _id: {
            $hour: { 
              date: '$timestamp',
              timezone: 'UTC'
            }
          },
          clicks: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' },
          uniqueUsers: { $addToSet: '$ipAddress' },
          loggedInUsers: {
            $addToSet: {
              $cond: [
                { $ne: ['$userId', null] },
                '$userId',
                '$$REMOVE'
              ]
            }
          },
          itemTypes: { $addToSet: '$itemType' },
          // Additional metrics for better insights
          totalTimeOnPage: { $sum: '$timeOnPage' },
          avgTimeOnPage: { $avg: '$timeOnPage' }
        }
      },
      {
        $project: {
          hour: '$_id',
          clicks: 1,
          uniqueSessionsCount: { $size: '$uniqueSessions' },
          uniqueUsersCount: { $size: '$uniqueUsers' },
          loggedInUsersCount: { $size: '$loggedInUsers' },
          itemTypesCount: { $size: '$itemTypes' },
          avgTimeOnPage: { $round: ['$avgTimeOnPage', 2] },
          totalTimeOnPage: 1,
          engagementRate: {
            $cond: [
              { $eq: ['$uniqueSessionsCount', 0] },
              0,
              { $divide: ['$clicks', '$uniqueSessionsCount'] }
            ]
          }
        }
      },
      { $sort: { hour: 1 } }
    ]);

    // Fill in missing hours with zero values and format properly
    const completeHourlyData = Array.from({ length: 24 }, (_, hour) => {
      const existingHour = hourlyDistribution.find(item => item.hour === hour);
      
      if (existingHour) {
        return {
          ...existingHour,
          hour: hour,
          hourLabel: `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:59`,
          hourFormatted: `${hour.toString().padStart(2, '0')}:00`,
          period: hour < 12 ? 'AM' : 'PM',
          periodLabel: hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night'
        };
      } else {
        return {
          hour: hour,
          hourLabel: `${hour.toString().padStart(2, '0')}:00 - ${hour.toString().padStart(2, '0')}:59`,
          hourFormatted: `${hour.toString().padStart(2, '0')}:00`,
          period: hour < 12 ? 'AM' : 'PM',
          periodLabel: hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night',
          clicks: 0,
          uniqueSessionsCount: 0,
          uniqueUsersCount: 0,
          loggedInUsersCount: 0,
          itemTypesCount: 0,
          avgTimeOnPage: 0,
          totalTimeOnPage: 0,
          engagementRate: 0
        };
      }
    });

    // Calculate summary statistics
    const totalClicks = hourlyDistribution.reduce((sum, item) => sum + item.clicks, 0);
    const peakHour = hourlyDistribution.reduce((max, item) => 
      item.clicks > max.clicks ? item : max, { clicks: 0, hour: 0 }
    );
    
    const activeHours = hourlyDistribution.filter(item => item.clicks > 0).length;
    const averageClicksPerHour = totalClicks > 0 ? Math.round(totalClicks / 24) : 0;
    
    // Calculate peak periods
    const periodStats = {
      morning: completeHourlyData.slice(6, 12).reduce((acc, hour) => ({
        clicks: acc.clicks + hour.clicks,
        sessions: acc.sessions + hour.uniqueSessionsCount
      }), { clicks: 0, sessions: 0 }),
      afternoon: completeHourlyData.slice(12, 17).reduce((acc, hour) => ({
        clicks: acc.clicks + hour.clicks,
        sessions: acc.sessions + hour.uniqueSessionsCount
      }), { clicks: 0, sessions: 0 }),
      evening: completeHourlyData.slice(17, 21).reduce((acc, hour) => ({
        clicks: acc.clicks + hour.clicks,
        sessions: acc.sessions + hour.uniqueSessionsCount
      }), { clicks: 0, sessions: 0 }),
      night: completeHourlyData.slice(21, 24).concat(completeHourlyData.slice(0, 6))
        .reduce((acc, hour) => ({
          clicks: acc.clicks + hour.clicks,
          sessions: acc.sessions + hour.uniqueSessionsCount
        }), { clicks: 0, sessions: 0 })
    };

    const peakPeriod = Object.entries(periodStats).reduce((max, [period, stats]) => 
      stats.clicks > max.clicks ? { period, ...stats } : max, 
      { period: 'morning', clicks: 0, sessions: 0 }
    );

    res.json({
      success: true,
      data: {
        hourlyDistribution: completeHourlyData,
        timeframe,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        },
        summary: {
          totalClicks,
          peakHour: {
            hour: peakHour.hour,
            hourLabel: `${peakHour.hour.toString().padStart(2, '0')}:00`,
            clicks: peakHour.clicks,
            sessions: peakHour.uniqueSessionsCount
          },
          averageClicksPerHour,
          activeHours,
          totalSessions: hourlyDistribution.reduce((sum, item) => sum + item.uniqueSessionsCount, 0),
          totalUsers: hourlyDistribution.reduce((sum, item) => sum + item.uniqueUsersCount, 0),
          peakPeriod: {
            period: peakPeriod.period,
            clicks: peakPeriod.clicks,
            sessions: peakPeriod.sessions
          },
          periodStats
        }
      }
    });

  } catch (error) {
    console.error('❌ Get hourly distribution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hourly distribution',
      error: error.message
    });
  }
};