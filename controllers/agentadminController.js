// controllers/agentController.js
const Agent = require('../models/Agent');
const User = require('../models/user');


exports.getAllAgents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      city,
      state,
      minExperience = 0,
      maxExperience = 50,
      minRating = 0,
      specialization,
      hasCompleteProfile = true
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter
    let filter = { isActive: true };
    
    // Experience filter
    filter.experienceYears = { $gte: parseInt(minExperience), $lte: parseInt(maxExperience) };
    
    // Rating filter
    filter['ratings.average'] = { $gte: parseFloat(minRating) };
    
    // Location filters
    if (city) {
      filter['officeAddress.city'] = new RegExp(city, 'i');
    }
    if (state) {
      filter['officeAddress.state'] = new RegExp(state, 'i');
    }
    
    // Specialization filter
    if (specialization) {
      filter.specializationAreas = { $in: [new RegExp(specialization, 'i')] };
    }
    
    // Profile completion filter
    if (hasCompleteProfile === 'true') {
      filter.licenseNumber = { $exists: true, $ne: '' };
      filter.experienceYears = { $gte: 0 };
      filter.specializationAreas = { $exists: true, $ne: [] };
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { agentId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { 'officeAddress.city': { $regex: search, $options: 'i' } },
        { specializationAreas: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Get agents with user details
    const agents = await Agent.find(filter)
      .populate({
        path: 'user',
        select: 'name lastName gmail phoneNumber avatar username'
      })
      .select('agentId name email phoneNumber company officeAddress experienceYears specializationAreas propertiesCount ratings profilePhoto bio')
      .sort({ propertiesCount: -1, 'ratings.average': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Agent.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: agents.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      agents
    });

  } catch (error) {
    console.error('Get all agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get agents',
      error: error.message
    });
  }
};

exports.getAgentByAgentId = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findOne({ agentId: agentId.toUpperCase() })
      .populate({
        path: 'user',
        select: 'name lastName gmail phoneNumber avatar username emailVerified createdAt'
      })
      .populate({
        path: 'properties',
        select: 'title price location propertyType status images',
        match: { status: 'active' }
      });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Check if profile is complete
    const isProfileComplete = agent.licenseNumber && 
                             agent.experienceYears >= 0 && 
                             agent.specializationAreas.length > 0;

    res.status(200).json({
      success: true,
      agent: {
        ...agent.toObject(),
        isProfileComplete,
        profileCompletion: isProfileComplete ? 100 : 
          ((agent.licenseNumber ? 33 : 0) + 
           (agent.experienceYears >= 0 ? 33 : 0) + 
           (agent.specializationAreas.length > 0 ? 34 : 0))
      }
    });

  } catch (error) {
    console.error('Get agent by agentId error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get agent',
      error: error.message
    });
  }
};

exports.searchAgents = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const agents = await Agent.find({
      isActive: true,
      $or: [
        { agentId: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } },
        { 'officeAddress.city': { $regex: q, $options: 'i' } }
      ]
    })
      .populate({
        path: 'user',
        select: 'name lastName avatar'
      })
      .select('agentId name company officeAddress specializationAreas propertiesCount ratings experienceYears profilePhoto')
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: agents.length,
      agents
    });

  } catch (error) {
    console.error('Search agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search agents',
      error: error.message
    });
  }
};