// controllers/adminAgentController.js
const User = require('../models/user');
const Agent = require('../models/Agent');
const PropertyUnit = require('../models/PropertyUnit');

// Get all agents with pagination and search
const getAllAgents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { agentId: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    const total = await Agent.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    const agents = await Agent.find(query)
      .select('name email phoneNumber agentId referralCode referralCount rewards isActive onboardedClients createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const agentsWithCount = agents.map(agent => ({
      ...agent.toObject(),
      appointmentCount: agent.onboardedClients?.length || 0
    }));
    
    res.status(200).json({
      success: true,
      agents: agentsWithCount,
      total,
      totalPages,
      currentPage: parseInt(page)
    });
    
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching agents',
      error: error.message
    });
  }
};

// Get global agent statistics for admin dashboard
const getGlobalAgentStats = async (req, res) => {
  try {
    const totalAgents = await Agent.countDocuments();
    const activeAgents = await Agent.countDocuments({ isActive: true });
    const suspendedAgents = await Agent.countDocuments({ isActive: false });
    
    const totalReferrals = await Agent.aggregate([
      { $group: { _id: null, total: { $sum: "$referralCount" } } }
    ]);
    
    const totalRewards = await Agent.aggregate([
      { $group: { _id: null, total: { $sum: "$rewards" } } }
    ]);
    
    const totalAppointments = await Agent.aggregate([
      { $unwind: "$onboardedClients" },
      { $group: { _id: null, total: { $sum: 1 } } }
    ]);
    
    const closedDeals = await Agent.aggregate([
      { $unwind: "$onboardedClients" },
      { $match: { "onboardedClients.status": "closed" } },
      { $group: { _id: null, total: { $sum: 1 } } }
    ]);
    
    const totalDealValue = await Agent.aggregate([
      { $unwind: "$onboardedClients" },
      { $group: { _id: null, total: { $sum: "$onboardedClients.dealValue" } } }
    ]);
    
    // Top agents by referrals
    const topAgentsByReferrals = await Agent.find()
      .sort({ referralCount: -1 })
      .limit(5)
      .select('name agentId referralCount rewards email phoneNumber');
    
    // Top agents by rewards
    const topAgentsByRewards = await Agent.find()
      .sort({ rewards: -1 })
      .limit(5)
      .select('name agentId referralCount rewards email phoneNumber');
    
    // Recent agents
    const recentAgents = await Agent.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name agentId email createdAt isActive');
    
    res.status(200).json({
      success: true,
      stats: {
        totalAgents,
        activeAgents,
        suspendedAgents,
        totalReferrals: totalReferrals[0]?.total || 0,
        totalRewards: totalRewards[0]?.total || 0,
        totalAppointments: totalAppointments[0]?.total || 0,
        closedDeals: closedDeals[0]?.total || 0,
        totalDealValue: totalDealValue[0]?.total || 0,
        topAgentsByReferrals,
        topAgentsByRewards,
        recentAgents
      }
    });
    
  } catch (error) {
    console.error('Error fetching global stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

// Get single agent summary
const getAgentSummary = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const agent = await Agent.findOne({ agentId: agentId })
      .populate('user', 'name email phoneNumber avatar createdAt')
      .populate('referralHistory.referredUser', 'name email phoneNumber username createdAt')
      .populate('onboardedClients.client', 'name email phoneNumber')
      .populate('onboardedClients.property', 'title address city propertyType');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    const totalReferrals = agent.referralHistory.length;
    const convertedReferrals = agent.referralHistory.filter(r => r.status === 'converted').length;
    const activeReferrals = agent.referralHistory.filter(r => r.status === 'active').length;
    
    const totalAppointments = agent.onboardedClients.length;
    const scheduledAppointments = agent.onboardedClients.filter(a => a.status === 'scheduled').length;
    const visitedAppointments = agent.onboardedClients.filter(a => a.status === 'visited').length;
    const interestedAppointments = agent.onboardedClients.filter(a => a.status === 'interested').length;
    const negotiationAppointments = agent.onboardedClients.filter(a => a.status === 'negotiation').length;
    const closedAppointments = agent.onboardedClients.filter(a => a.status === 'closed').length;
    const cancelledAppointments = agent.onboardedClients.filter(a => a.status === 'cancelled').length;
    
    const totalDealValue = agent.onboardedClients.reduce((sum, a) => sum + (a.dealValue || 0), 0);
    
    res.status(200).json({
      success: true,
      agent: {
        id: agent._id,
        agentId: agent.agentId,
        name: agent.name,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        referralCode: agent.referralCode,
        isActive: agent.isActive,
        rewards: agent.rewards,
        referralCount: agent.referralCount,
        createdAt: agent.createdAt,
        user: agent.user,
        stats: {
          totalReferrals,
          convertedReferrals,
          activeReferrals,
          totalAppointments,
          scheduledAppointments,
          visitedAppointments,
          interestedAppointments,
          negotiationAppointments,
          closedAppointments,
          cancelledAppointments,
          totalDealValue
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching agent summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching agent summary',
      error: error.message
    });
  }
};

// Get agent's referred users
const getAgentReferredUsers = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const agent = await Agent.findOne({ agentId: agentId })
      .populate('referralHistory.referredUser', 'name email phoneNumber username createdAt');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    const referredUsers = agent.referralHistory
      .filter(r => r.referredUser)
      .map(r => ({
        id: r._id,
        user: r.referredUser,
        referredAt: r.referredAt,
        status: r.status,
        rewardAmount: r.rewardAmount
      }));
    
    res.status(200).json({
      success: true,
      referredUsers,
      total: referredUsers.length
    });
    
  } catch (error) {
    console.error('Error fetching referred users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referred users',
      error: error.message
    });
  }
};

// Get agent's appointments
const getAgentAppointments = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const agent = await Agent.findOne({ agentId: agentId })
      .populate('onboardedClients.client', 'name email phoneNumber username')
      .populate('onboardedClients.property', 'title address city propertyType images');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    const appointments = agent.onboardedClients.map(appointment => ({
      id: appointment._id,
      client: appointment.client,
      property: appointment.property,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      status: appointment.status,
      dealValue: appointment.dealValue,
      rewardEarned: appointment.rewardEarned,
      notes: appointment.notes,
      visitedAt: appointment.visitedAt,
      followUpDate: appointment.followUpDate,
      feedback: appointment.feedback,
      createdAt: appointment.createdAt
    }));
    
    res.status(200).json({
      success: true,
      appointments,
      total: appointments.length
    });
    
  } catch (error) {
    console.error('Error fetching agent appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
};

// Update agent status (activate/suspend)
const updateAgentStatus = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { isActive, reason } = req.body;
    
    const agent = await Agent.findOne({ agentId: agentId });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    agent.isActive = isActive;
    await agent.save();
    
    res.status(200).json({
      success: true,
      message: isActive ? 'Agent activated successfully' : 'Agent suspended successfully',
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        isActive: agent.isActive
      }
    });
    
  } catch (error) {
    console.error('Error updating agent status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating agent status',
      error: error.message
    });
  }
};

module.exports = {
  getAllAgents,
  getGlobalAgentStats,
  getAgentSummary,
  getAgentReferredUsers,
  getAgentAppointments,
  updateAgentStatus
};