// controllers/agentProfileController.js
const Agent = require('../models/Agent');
const User = require('../models/user');

// @desc    Get agent profile completion form (for newly approved agents)
// @route   GET /api/agents/complete-profile
// @access  Private/Agent
exports.getProfileCompletionForm = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('agentProfile');
    
    // Check if user is an approved agent
    if (!user || !user.isApprovedAgent()) {
      return res.status(403).json({
        success: false,
        message: 'Only approved agents can access this form'
      });
    }

    const agent = await Agent.findById(user.agentProfile);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    // Return current data and required fields
    res.status(200).json({
      success: true,
      message: 'Please complete your agent profile',
      agentId: agent.agentId,
      currentData: {
        name: agent.name,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        company: agent.company,
        officeAddress: agent.officeAddress,
        experienceYears: agent.experienceYears
      },
      requiredFields: [
        {
          field: 'licenseNumber',
          label: 'Real Estate License Number',
          required: true,
          type: 'text'
        },
        {
          field: 'experienceYears',
          label: 'Years of Experience',
          required: true,
          type: 'number',
          min: 0
        },
        {
          field: 'specializationAreas',
          label: 'Specialization Areas',
          required: true,
          type: 'array',
          suggestions: ['Residential', 'Commercial', 'Luxury', 'Rental', 'Land', 'Industrial']
        }
      ],
      optionalFields: [
        {
          field: 'bio',
          label: 'Professional Bio',
          type: 'textarea',
          maxLength: 2000
        },
        {
          field: 'certifications',
          label: 'Certifications',
          type: 'array'
        },
        {
          field: 'languages',
          label: 'Languages Spoken',
          type: 'array'
        },
        {
          field: 'socialLinks',
          label: 'Social Media Links',
          type: 'object',
          fields: ['facebook', 'twitter', 'linkedin', 'instagram', 'website']
        }
      ]
    });

  } catch (error) {
    console.error('Get profile completion form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile completion form',
      error: error.message
    });
  }
};

// @desc    Complete agent profile with additional information
// @route   POST /api/agents/complete-profile
// @access  Private/Agent
exports.completeAgentProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Check if user is an approved agent
    if (!user || !user.isApprovedAgent()) {
      return res.status(403).json({
        success: false,
        message: 'Only approved agents can complete profile'
      });
    }

    const {
      licenseNumber,
      experienceYears,
      specializationAreas,
      certifications,
      bio,
      profilePhoto,
      socialLinks,
      languages,
      alternativePhoneNumber,
      officeAddress
    } = req.body;

    // Validate required fields
    if (!licenseNumber || !experienceYears || !specializationAreas || !Array.isArray(specializationAreas)) {
      return res.status(400).json({
        success: false,
        message: 'License number, experience years, and specialization areas are required'
      });
    }

    // Get agent profile
    const agent = await Agent.findById(user.agentProfile);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    // Update agent profile with new data
    agent.licenseNumber = licenseNumber;
    agent.experienceYears = experienceYears;
    agent.specializationAreas = specializationAreas;
    agent.certifications = certifications || [];
    agent.bio = bio || '';
    agent.profilePhoto = profilePhoto || user.avatar || '';
    agent.socialLinks = socialLinks || {};
    agent.languages = languages || [];
    agent.alternativePhoneNumber = alternativePhoneNumber || '';
    
    // Update office address if provided
    if (officeAddress) {
      agent.officeAddress = {
        street: officeAddress.street || agent.officeAddress.street,
        city: officeAddress.city || agent.officeAddress.city,
        state: officeAddress.state || agent.officeAddress.state,
        pincode: officeAddress.pincode || agent.officeAddress.pincode,
        country: officeAddress.country || agent.officeAddress.country || 'India'
      };
    }

    // Update user's alternative phone if provided
    if (alternativePhoneNumber) {
      user.alternativePhoneNumber = alternativePhoneNumber;
      await user.save();
    }

    await agent.save();

    // Populate user details
    await agent.populate('user', 'name lastName gmail phoneNumber avatar username');

    res.status(200).json({
      success: true,
      message: 'Agent profile completed successfully',
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        email: agent.email,
        phone: agent.phoneNumber,
        company: agent.company,
        licenseNumber: agent.licenseNumber,
        experienceYears: agent.experienceYears,
        specializationAreas: agent.specializationAreas,
        isProfileComplete: true
      }
    });

  } catch (error) {
    console.error('Complete agent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete agent profile',
      error: error.message
    });
  }
};

// @desc    Get agent's current profile status
// @desc    POST /api/agents/profile/status
// @access  Private/Agent
exports.getProfileStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let agent = null;
    let profileCompletion = 0;
    let missingFields = [];

    if (user.isApprovedAgent()) {
      agent = await Agent.findById(user.agentProfile);
      
      if (agent) {
        // Calculate profile completion percentage
        const requiredFields = ['licenseNumber', 'experienceYears', 'specializationAreas'];
        const optionalFields = ['bio', 'profilePhoto', 'socialLinks', 'certifications'];
        const allFields = [...requiredFields, ...optionalFields];
        
        let completed = 0;
        missingFields = [];
        
        requiredFields.forEach(field => {
          if (agent[field] && (Array.isArray(agent[field]) ? agent[field].length > 0 : true)) {
            completed++;
          } else {
            missingFields.push(field);
          }
        });
        
        optionalFields.forEach(field => {
          if (agent[field] && (Array.isArray(agent[field]) ? agent[field].length > 0 : true)) {
            completed++;
          }
        });
        
        profileCompletion = Math.round((completed / allFields.length) * 100);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        userType: user.userType,
        isApprovedAgent: user.isApprovedAgent(),
        isPendingAgent: user.isPendingAgent(),
        agentProfile: agent ? {
          agentId: agent.agentId,
          isActive: agent.isActive,
          profileCompletion,
          missingFields,
          isProfileComplete: profileCompletion >= 80 // 80% considered complete
        } : null
      }
    });

  } catch (error) {
    console.error('Get profile status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile status',
      error: error.message
    });
  }
};

// @desc    Update agent profile (for existing agents)
// @route   PUT /api/agents/profile
// @access  Private/Agent
exports.updateAgentProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user || !user.isApprovedAgent()) {
      return res.status(403).json({
        success: false,
        message: 'Only approved agents can update profile'
      });
    }

    const agent = await Agent.findById(user.agentProfile);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }

    // Allowed fields for update
    const allowedUpdates = [
      'licenseNumber',
      'experienceYears',
      'specializationAreas',
      'certifications',
      'bio',
      'profilePhoto',
      'socialLinks',
      'languages',
      'alternativePhoneNumber',
      'company',
      'officeAddress'
    ];

    // Update only allowed fields
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        agent[field] = req.body[field];
      }
    });

    await agent.save();

    // Update user's company if changed
    if (req.body.company && req.body.company !== user.company) {
      user.company = req.body.company;
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Agent profile updated successfully',
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        email: agent.email,
        company: agent.company,
        licenseNumber: agent.licenseNumber,
        experienceYears: agent.experienceYears,
        specializationAreas: agent.specializationAreas
      }
    });

  } catch (error) {
    console.error('Update agent profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update agent profile',
      error: error.message
    });
  }
};