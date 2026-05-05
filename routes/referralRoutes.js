// routes/referralRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Agent = require('../models/Agent');

/**
 * GET /api/referrals/status/:userId
 * Check if user already has a referral
 */
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find if any agent has this user in their referral history
    const agentWithReferral = await Agent.findOne({
      'referralHistory.referredUser': userId
    });
    
    if (agentWithReferral) {
      const referralEntry = agentWithReferral.referralHistory.find(
        r => r.referredUser && r.referredUser.toString() === userId
      );
      
      return res.json({
        success: true,
        hasReferral: true,
        referralInfo: {
          agentId: agentWithReferral._id,
          agentName: agentWithReferral.name,
          agentCode: agentWithReferral.referralCode,
          appliedAt: referralEntry?.referredAt || new Date(),
          status: referralEntry?.status || 'active'
        }
      });
    }
    
    res.json({
      success: true,
      hasReferral: false,
      referralInfo: null
    });
  } catch (error) {
    console.error('Error checking referral status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking referral status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/referrals/search/:referralCode
 * Search agent by referral code
 */
router.get('/search/:referralCode', async (req, res) => {
  try {
    const { referralCode } = req.params;
    
    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: 'Referral code is required'
      });
    }
    
    const agent = await Agent.findOne({ referralCode: referralCode.toUpperCase() })
      .select('name referralCode referralCount rewards ratings email phoneNumber profilePhoto experienceYears bio');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code. Please check and try again.'
      });
    }
    
    res.json({
      success: true,
      agent: {
        id: agent._id,
        name: agent.name,
        referralCode: agent.referralCode,
        referralCount: agent.referralCount || 0,
        rewards: agent.rewards || 0,
        ratings: agent.ratings || { average: 0, totalReviews: 0 },
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        profilePhoto: agent.profilePhoto,
        experienceYears: agent.experienceYears || 0,
        bio: agent.bio
      }
    });
  } catch (error) {
    console.error('Error searching referral code:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching referral code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/referrals/apply
 * Apply referral code for a user (One-time only)
 */
router.post('/apply', async (req, res) => {
  try {
    const { userId, referralCode } = req.body;
    
    if (!userId || !referralCode) {
      return res.status(400).json({
        success: false,
        message: 'User ID and referral code are required'
      });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // CRITICAL: Check if user already has a referral (One-time check)
    const existingReferral = await Agent.findOne({
      'referralHistory.referredUser': userId
    });
    
    if (existingReferral) {
      return res.status(400).json({
        success: false,
        message: 'You have already used a referral code. Only one referral is allowed per user.'
      });
    }
    
    // Find the agent by referral code
    const agent = await Agent.findOne({ referralCode: referralCode.toUpperCase() });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }
    
    // Check if user is trying to refer themselves
    if (agent.user.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot use your own referral code'
      });
    }
    
    // Add user to agent's referral history
    agent.referralCount = (agent.referralCount || 0) + 1;
    agent.rewards = (agent.rewards || 0) + 100;
    
    agent.referralHistory.push({
      referredUser: userId,
      referredAgent: null,
      referredAt: new Date(),
      status: 'active',
      rewardAmount: 100
    });
    
    await agent.save();
    
    // If user is an agent, also update their referredBy field
    if (user.userType === 'agent') {
      user.referredBy = agent._id;
      await user.save();
      
      // Also update the agent's profile
      const userAgentProfile = await Agent.findOne({ user: userId });
      if (userAgentProfile) {
        userAgentProfile.referredBy = agent._id;
        await userAgentProfile.save();
      }
    }
    
    res.json({
      success: true,
      message: 'Referral code applied successfully',
      agent: {
        id: agent._id,
        name: agent.name,
        referralCode: agent.referralCode,
        referralCount: agent.referralCount
      }
    });
  } catch (error) {
    console.error('Error applying referral:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying referral code',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/referrals/agent/:agentId/stats
 * Get referral statistics for an agent
 */
router.get('/agent/:agentId/stats', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const agent = await Agent.findById(agentId)
      .select('referralCode referralCount rewards referralHistory');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    const totalReferrals = agent.referralHistory.length;
    const activeReferrals = agent.referralHistory.filter(r => r.status === 'active').length;
    const convertedReferrals = agent.referralHistory.filter(r => r.status === 'converted').length;
    
    res.json({
      success: true,
      stats: {
        referralCode: agent.referralCode,
        totalReferrals: agent.referralCount || 0,
        rewards: agent.rewards || 0,
        referralHistoryCount: totalReferrals,
        activeReferrals,
        convertedReferrals,
        conversionRate: totalReferrals > 0 ? (convertedReferrals / totalReferrals) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching agent statistics'
    });
  }
});

/**
 * GET /api/referrals/agent/:agentId/history
 * Get referral history for an agent with pagination
 */
router.get('/agent/:agentId/history', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    
    const agent = await Agent.findById(agentId);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    let referralHistory = [...agent.referralHistory];
    
    // Filter by status if provided
    if (status) {
      referralHistory = referralHistory.filter(r => r.status === status);
    }
    
    // Sort by referredAt descending (newest first)
    referralHistory.sort((a, b) => new Date(b.referredAt) - new Date(a.referredAt));
    
    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedHistory = referralHistory.slice(startIndex, endIndex);
    
    // Populate user details for each referral
    const populatedHistory = await Promise.all(
      paginatedHistory.map(async (referral) => {
        let referredUserDetails = null;
        if (referral.referredUser) {
          const user = await User.findById(referral.referredUser)
            .select('username name lastName gmail phoneNumber userType createdAt');
          if (user) {
            referredUserDetails = {
              id: user._id,
              username: user.username,
              name: user.name,
              lastName: user.lastName,
              gmail: user.gmail,
              phoneNumber: user.phoneNumber,
              userType: user.userType,
              registeredAt: user.createdAt
            };
          }
        }
        
        return {
          id: referral._id,
          referredUser: referredUserDetails,
          referredAt: referral.referredAt,
          status: referral.status,
          rewardAmount: referral.rewardAmount
        };
      })
    );
    
    res.json({
      success: true,
      history: populatedHistory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(referralHistory.length / limit),
        totalItems: referralHistory.length,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching referral history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching referral history'
    });
  }
});

/**
 * GET /api/referrals/generate-link/:referralCode
 * Generate referral link for sharing
 */
router.get('/generate-link/:referralCode', async (req, res) => {
  try {
    const { referralCode } = req.params;
    const { baseUrl = 'https://www.cleartitle1.com' } = req.query;
    
    const agent = await Agent.findOne({ referralCode });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code'
      });
    }
    
    const referralLink = `${baseUrl}/register?ref=${referralCode}`;
    
    res.json({
      success: true,
      data: {
        referralCode: agent.referralCode,
        referralLink: referralLink,
        shareText: `Join ClearTitle1 using my referral link: ${referralLink}`,
        agentName: agent.name
      }
    });
  } catch (error) {
    console.error('Error generating referral link:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating referral link'
    });
  }
});

module.exports = router;