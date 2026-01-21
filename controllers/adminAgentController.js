// controllers/adminAgentController.js
const User = require('../models/user');
const Agent = require('../models/Agent');
const Counter = require('../models/Counter');

// @desc    Get all agent applications
// @route   GET /api/admin/agents/applications
// @access  Private/Admin
exports.getAgentApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    
    // Build query
    let query = { userType: 'agent' };
    
    // Filter by approval status
    if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      query['agentApproval.status'] = status;
    } else {
      // Default to pending if no status specified
      query['agentApproval.status'] = 'pending';
    }
    
    // Search by username, name, email, or phone
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { gmail: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const users = await User.find(query)
      .select('-password')
      .sort({ 'agentApproval.appliedAt': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('agentProfile', 'agentId name email phoneNumber')
      .populate('agentApproval.reviewedBy', 'username name');
    
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      agents: users
    });
  } catch (error) {
    console.error('Get agent applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get agent by agentId
// @route   GET /api/admin/agents/:agentId
// @access  Private/Admin
exports.getAgentById = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Search by agentId (case insensitive)
    const agent = await Agent.findOne({ 
      agentId: { $regex: new RegExp(`^${agentId}$`, 'i') }
    })
    .populate('user', 'username name lastName gmail phoneNumber userType agentApproval avatar')
    .populate('approvedBy', 'username name');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    res.status(200).json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('Get agent by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Search agents by various criteria
// @route   GET /api/admin/agents/search
// @access  Private/Admin
exports.searchAgents = async (req, res) => {
  try {
    const { agentId, email, phone, name, company, city, status } = req.query;
    
    let query = {};
    
    // Build search query for Agent model
    if (agentId) {
      query.agentId = { $regex: agentId, $options: 'i' };
    }
    if (email) {
      query.email = { $regex: email, $options: 'i' };
    }
    if (phone) {
      query.phoneNumber = { $regex: phone, $options: 'i' };
    }
    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }
    if (company) {
      query.company = { $regex: company, $options: 'i' };
    }
    if (city) {
      query['officeAddress.city'] = { $regex: city, $options: 'i' };
    }
    
    // If status is provided, we need to join with User model
    let agents;
    
    if (status) {
      // Get all agents with the status filter
      const users = await User.find({
        'agentApproval.status': status,
        userType: 'agent'
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      
      // Add user filter to query
      if (userIds.length > 0) {
        query.user = { $in: userIds };
      } else {
        // No users with this status, return empty
        return res.status(200).json({
          success: true,
          count: 0,
          agents: []
        });
      }
    }
    
    agents = await Agent.find(query)
      .populate('user', 'username name lastName gmail phoneNumber userType agentApproval avatar')
      .populate('approvedBy', 'username name')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.status(200).json({
      success: true,
      count: agents.length,
      agents
    });
  } catch (error) {
    console.error('Search agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Approve agent application and create agent profile
// @route   PUT /api/admin/agents/:userId/approve
// @access  Private/Admin
exports.approveAgent = async (req, res) => {
  try {
    const { userId } = req.params;
    const { licenseNumber, experienceYears, specializationAreas, notes } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.userType !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'User is not registered as an agent'
      });
    }
    
    if (user.agentApproval.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Agent is already approved'
      });
    }
    
    // Create Agent profile
    const agentData = {
      user: user._id,
      licenseNumber: licenseNumber || '',
      experienceYears: experienceYears || 0,
      specializationAreas: specializationAreas || [],
      name: `${user.name} ${user.lastName || ''}`.trim(),
      email: user.gmail,
      phoneNumber: user.phoneNumber,
      company: user.company || '',
      officeAddress: user.officeAddress || {},
      approvedBy: req.user.id
    };
    
    // Generate agentId using Counter
    const counter = await Counter.findOneAndUpdate(
      { name: 'agentId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    agentData.agentId = `cleartitle${counter.seq}`;
    
    // Create agent profile
    const agent = await Agent.create(agentData);
    
    // Update user's agent approval status and link agent profile
    user.agentApproval.status = 'approved';
    user.agentApproval.reviewedAt = new Date();
    user.agentApproval.reviewedBy = req.user.id;
    user.agentApproval.notes = notes || '';
    user.agentProfile = agent._id;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Agent approved successfully',
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.gmail,
        userType: user.userType,
        agentApproval: user.agentApproval
      },
      agent: {
        _id: agent._id,
        agentId: agent.agentId,
        name: agent.name,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        company: agent.company
      }
    });
  } catch (error) {
    console.error('Approve agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reject agent application
// @route   PUT /api/admin/agents/:userId/reject
// @access  Private/Admin
exports.rejectAgent = async (req, res) => {
  try {
    const { userId } = req.params;
    const { rejectionReason, notes } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.userType !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'User is not registered as an agent'
      });
    }
    
    // Update user's agent approval status
    user.agentApproval.status = 'rejected';
    user.agentApproval.reviewedAt = new Date();
    user.agentApproval.reviewedBy = req.user.id;
    user.agentApproval.rejectionReason = rejectionReason;
    user.agentApproval.notes = notes || '';
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Agent application rejected',
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.gmail,
        userType: user.userType,
        agentApproval: user.agentApproval
      }
    });
  } catch (error) {
    console.error('Reject agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Set agent back to pending status
// @route   PUT /api/admin/agents/:userId/pending
// @access  Private/Admin
exports.setAgentToPending = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.userType !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'User is not registered as an agent'
      });
    }
    
    // Update user's agent approval status
    user.agentApproval.status = 'pending';
    user.agentApproval.reviewedAt = new Date();
    user.agentApproval.reviewedBy = req.user.id;
    user.agentApproval.notes = notes || '';
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Agent status set to pending',
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.gmail,
        userType: user.userType,
        agentApproval: user.agentApproval
      }
    });
  } catch (error) {
    console.error('Set agent to pending error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Suspend an approved agent
// @route   PUT /api/admin/agents/:userId/suspend
// @access  Private/Admin
exports.suspendAgent = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, notes } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Suspension reason is required'
      });
    }
    
    const user = await User.findById(userId).populate('agentProfile');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.userType !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'User is not registered as an agent'
      });
    }
    
    if (user.agentApproval.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved agents can be suspended'
      });
    }
    
    // Update user's agent approval status
    user.agentApproval.status = 'suspended';
    user.agentApproval.reviewedAt = new Date();
    user.agentApproval.reviewedBy = req.user.id;
    user.agentApproval.rejectionReason = reason;
    user.agentApproval.notes = notes || '';
    
    // Also update agent profile status
    if (user.agentProfile) {
      const agent = await Agent.findById(user.agentProfile._id);
      if (agent) {
        agent.isActive = false;
        await agent.save();
      }
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Agent suspended successfully',
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.gmail,
        userType: user.userType,
        agentApproval: user.agentApproval
      }
    });
  } catch (error) {
    console.error('Suspend agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Reactivate a suspended agent
// @route   PUT /api/admin/agents/:userId/reactivate
// @access  Private/Admin
exports.reactivateAgent = async (req, res) => {
  try {
    const { userId } = req.params;
    const { notes } = req.body;
    
    const user = await User.findById(userId).populate('agentProfile');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.userType !== 'agent') {
      return res.status(400).json({
        success: false,
        message: 'User is not registered as an agent'
      });
    }
    
    if (user.agentApproval.status !== 'suspended') {
      return res.status(400).json({
        success: false,
        message: 'Only suspended agents can be reactivated'
      });
    }
    
    // Update user's agent approval status
    user.agentApproval.status = 'approved';
    user.agentApproval.reviewedAt = new Date();
    user.agentApproval.reviewedBy = req.user.id;
    user.agentApproval.notes = notes || '';
    
    // Also update agent profile status
    if (user.agentProfile) {
      const agent = await Agent.findById(user.agentProfile._id);
      if (agent) {
        agent.isActive = true;
        await agent.save();
      }
    }
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Agent reactivated successfully',
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.gmail,
        userType: user.userType,
        agentApproval: user.agentApproval
      }
    });
  } catch (error) {
    console.error('Reactivate agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// @desc    Get agent approval statistics
// @route   GET /api/admin/agents/stats
// @access  Private/Admin
exports.getAgentStats = async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { userType: 'agent' } },
      {
        $group: {
          _id: '$agentApproval.status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format stats
    const formattedStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      total: 0
    };
    
    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });
    
    // Get total agents count
    const totalAgents = await Agent.countDocuments();
    const totalUsers = await User.countDocuments({ userType: 'agent' });
    
    res.status(200).json({
      success: true,
      stats: formattedStats,
      totalAgents,
      totalAgentUsers: totalUsers
    });
  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};