const Enquiry = require('../models/enquiries');
const User = require('../models/user');
// Create new enquiry (public route)
const createEnquiry = async (req, res) => {
  try {
    const { name, phoneNumber, message, userId } = req.body;

    // Basic validation
    if (!name || !phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone number, and message are required'
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[0-9+\-\s()]{10,}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }

    // If userId is provided, verify the user exists
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }
    }

    const enquiry = new Enquiry({
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      message: message.trim(),
      user: userId || null,
      status: 'new'
    });

    await enquiry.save();

    // Populate user data if needed
    await enquiry.populate('user', 'name username phoneNumber email');

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully',
      enquiry: {
        id: enquiry._id,
        name: enquiry.name,
        phoneNumber: enquiry.phoneNumber,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        user: enquiry.user ? {
          id: enquiry.user._id,
          name: enquiry.user.name,
          email: enquiry.user.email
        } : null
      }
    });
  } catch (error) {
    console.error('Error creating enquiry:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error submitting enquiry. Please try again.'
    });
  }
};

// Get all enquiries with pagination and filters
const getAllEnquiries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = '',
      search = ''
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: {
        path: 'user',
        select: 'name username phoneNumber email'
      }
    };

    const enquiries = await Enquiry.find(filter)
      .populate('user', 'name username phoneNumber email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Enquiry.countDocuments(filter);

    res.json({
      success: true,
      enquiries,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enquiries'
    });
  }
};

// Get enquiry by ID
const getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id)
      .populate('user', 'name username phoneNumber email');

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.json({
      success: true,
      enquiry
    });
  } catch (error) {
    console.error('Error fetching enquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enquiry'
    });
  }
};

// Update enquiry status
const updateEnquiryStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    
    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        ...(adminNotes && { adminNotes }),
        updatedAt: new Date()
      },
      { new: true }
    ).populate('user', 'name username phoneNumber email');

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.json({
      success: true,
      enquiry
    });
  } catch (error) {
    console.error('Error updating enquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating enquiry'
    });
  }
};

// Add notes to enquiry
const addEnquiryNotes = async (req, res) => {
  try {
    const { notes } = req.body;
    
    const enquiry = await Enquiry.findByIdAndUpdate(
      req.params.id,
      { 
        adminNotes: notes,
        updatedAt: new Date()
      },
      { new: true }
    ).populate('user', 'name username phoneNumber email');

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.json({
      success: true,
      enquiry
    });
  } catch (error) {
    console.error('Error adding enquiry notes:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding enquiry notes'
    });
  }
};

// Delete enquiry
const deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: 'Enquiry not found'
      });
    }

    res.json({
      success: true,
      message: 'Enquiry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting enquiry:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting enquiry'
    });
  }
};

// Bulk update enquiries
const bulkUpdateEnquiries = async (req, res) => {
  try {
    const { enquiryIds, updates } = req.body;

    const result = await Enquiry.updateMany(
      { _id: { $in: enquiryIds } },
      { ...updates, updatedAt: new Date() }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} enquiries updated successfully`
    });
  } catch (error) {
    console.error('Error bulk updating enquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Error bulk updating enquiries'
    });
  }
};

// Get enquiry statistics
const getEnquiryStats = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range based on timeframe
    const dateRange = calculateDateRange(timeframe);
    
    const stats = await Enquiry.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Enquiry.countDocuments({
      createdAt: { $gte: dateRange.start }
    });

    // Format stats
    const formattedStats = {
      total,
      new: 0,
      'in-progress': 0,
      resolved: 0,
      closed: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
    });

    res.json({
      success: true,
      stats: formattedStats
    });
  } catch (error) {
    console.error('Error fetching enquiry stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching enquiry stats'
    });
  }
};

// Export enquiries
const exportEnquiries = async (req, res) => {
  try {
    const { format = 'json', timeframe = '30d', status = '' } = req.query;

    // Build filter
    const filter = {};
    const dateRange = calculateDateRange(timeframe);
    filter.createdAt = { $gte: dateRange.start };

    if (status) {
      filter.status = status;
    }

    const enquiries = await Enquiry.find(filter)
      .populate('user', 'name username phoneNumber email')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // Convert to CSV
      const csvData = convertToCSV(enquiries);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=enquiries-${Date.now()}.csv`);
      return res.send(csvData);
    } else {
      // Return JSON
      res.json({
        success: true,
        enquiries
      });
    }
  } catch (error) {
    console.error('Error exporting enquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting enquiries'
    });
  }
};

// Get enquiries by user ID
const getEnquiriesByUserId = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { userId } = req.params;

    const enquiries = await Enquiry.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Enquiry.countDocuments({ user: userId });

    res.json({
      success: true,
      enquiries,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching user enquiries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user enquiries'
    });
  }
};

// Helper function to calculate date range
function calculateDateRange(timeframe) {
  const now = new Date();
  let startDate = new Date();

  switch (timeframe) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  return { start: startDate, end: now };
}

// Helper function to convert enquiries to CSV
function convertToCSV(enquiries) {
  const headers = ['Name', 'Phone', 'Email', 'Message', 'Status', 'Created At', 'User'];
  const rows = enquiries.map(enquiry => [
    enquiry.name,
    enquiry.phoneNumber,
    enquiry.user?.email || 'N/A',
    `"${enquiry.message.replace(/"/g, '""')}"`, // Escape quotes for CSV
    enquiry.status,
    enquiry.createdAt.toISOString(),
    enquiry.user?.name || 'Guest'
  ]);

  return [headers, ...rows]
    .map(row => row.join(','))
    .join('\n');
}

module.exports = {  createEnquiry,
  getAllEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
  addEnquiryNotes,
  deleteEnquiry,
  bulkUpdateEnquiries,
  getEnquiryStats,
  exportEnquiries,
  getEnquiriesByUserId
};