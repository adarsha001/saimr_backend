const Agent = require('../models/Agent');
const PropertyUnit = require('../models/PropertyUnit');
const User = require('../models/user');

// POST /api/bookings/appointments
const bookAppointment = async (req, res) => {
  try {
    const { propertyId, appointmentDate, appointmentTime, notes } = req.body;
    const userId = req.user.id;

    if (!propertyId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'Property ID, appointment date and time are required'
      });
    }

    const property = await PropertyUnit.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let wasReferred = false;
    let referringAgent = null;

    // Check if user was referred by any agent (optional)
    referringAgent = await Agent.findOne({
      'referralHistory.referredUser': userId
    });

    if (referringAgent) {
      wasReferred = true;
      
      // Check if user already has a pending appointment for this property
      const existingBooking = referringAgent.onboardedClients.find(
        client => client.client.toString() === userId && 
                  client.property.toString() === propertyId &&
                  client.status === 'scheduled'
      );

      if (!existingBooking) {
        // Add to onboardedClients array only (single source of truth)
        referringAgent.onboardedClients.push({
          client: userId,
          property: propertyId,
          appointmentDate: new Date(appointmentDate),
          appointmentTime: appointmentTime,
          visitedAt: new Date(),
          status: 'scheduled',
          dealValue: null,
          rewardEarned: 0,
          notes: notes || '',
          followUpDate: null,
          feedback: null,
          createdAt: new Date()
        });

        // Update agent stats
        referringAgent.stats.totalAppointments = (referringAgent.stats.totalAppointments || 0) + 1;
        referringAgent.clientsCount = (referringAgent.clientsCount || 0) + 1;
        
        // Update referral status from 'active' to 'converted'
        const referralEntry = referringAgent.referralHistory.find(
          r => r.referredUser && r.referredUser.toString() === userId
        );
        
        if (referralEntry && referralEntry.status === 'active') {
          referralEntry.status = 'converted';
        }
        
        await referringAgent.save();
      }
    }

    res.status(201).json({
      success: true,
      message: wasReferred ? 'Appointment booked successfully! Your referring agent has been notified.' : 'Appointment booked successfully!',
      data: {
        wasReferred,
        agent: wasReferred ? {
          name: referringAgent.name,
          phoneNumber: referringAgent.phoneNumber
        } : null
      }
    });

  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error booking appointment',
      error: error.message
    });
  }
};

// GET /api/bookings/appointments/my
const getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Find the agent that referred this user
    const referringAgent = await Agent.findOne({
      'referralHistory.referredUser': userId
    }).populate('onboardedClients.property', 'title address city propertyType images');
    
    if (!referringAgent) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No appointments found'
      });
    }
    
    // Get user's appointments from onboardedClients
    const userAppointments = referringAgent.onboardedClients.filter(
      client => client.client.toString() === userId
    );
    
    res.status(200).json({
      success: true,
      data: userAppointments
    });
    
  } catch (error) {
    console.error('Error fetching user appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
};

// GET /api/bookings/agent/appointments
const getAgentAppointments = async (req, res) => {
  try {
    const agent = await Agent.findOne({ user: req.user.id })
      .populate('onboardedClients.client', 'name email phoneNumber username gmail')
      .populate('onboardedClients.property', 'title address city propertyType images');
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }
    
    // Format appointments with full user details
    const formattedAppointments = agent.onboardedClients.map(appointment => ({
      id: appointment._id,
      client: {
        id: appointment.client._id,
        name: appointment.client.name,
        email: appointment.client.email || appointment.client.gmail,
        phoneNumber: appointment.client.phoneNumber,
        username: appointment.client.username
      },
      property: {
        id: appointment.property._id,
        title: appointment.property.title,
        address: appointment.property.address,
        city: appointment.property.city,
        propertyType: appointment.property.propertyType
      },
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      status: appointment.status,
      visitedAt: appointment.visitedAt,
      dealValue: appointment.dealValue,
      rewardEarned: appointment.rewardEarned,
      notes: appointment.notes,
      followUpDate: appointment.followUpDate,
      feedback: appointment.feedback,
      createdAt: appointment.createdAt
    }));
    
    // Group by status for statistics
    const scheduled = formattedAppointments.filter(a => a.status === 'scheduled');
    const visited = formattedAppointments.filter(a => a.status === 'visited');
    const interested = formattedAppointments.filter(a => a.status === 'interested');
    const negotiation = formattedAppointments.filter(a => a.status === 'negotiation');
    const closed = formattedAppointments.filter(a => a.status === 'closed');
    const rejected = formattedAppointments.filter(a => a.status === 'rejected');
    const cancelled = formattedAppointments.filter(a => a.status === 'cancelled');
    
    res.status(200).json({
      success: true,
      data: {
        total: formattedAppointments.length,
        stats: {
          scheduled: scheduled.length,
          visited: visited.length,
          interested: interested.length,
          negotiation: negotiation.length,
          closed: closed.length,
          rejected: rejected.length,
          cancelled: cancelled.length
        },
        appointments: formattedAppointments
      }
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

// PUT /api/bookings/appointments/:appointmentId/status
const updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { 
      status, 
      dealValue, 
      notes, 
      followUpDate, 
      feedback 
    } = req.body;
    
    const agent = await Agent.findOne({ user: req.user.id });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent profile not found'
      });
    }
    
    // Find the appointment in onboardedClients
    const appointment = agent.onboardedClients.id(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Get client details for reference
    const client = await User.findById(appointment.client);
    
    // Update appointment fields
    appointment.status = status;
    
    if (notes) appointment.notes = notes;
    if (followUpDate) appointment.followUpDate = new Date(followUpDate);
    
    // If marked as visited, update visitedAt
    if (status === 'visited' && !appointment.visitedAt) {
      appointment.visitedAt = new Date();
      agent.stats.completedVisits = (agent.stats.completedVisits || 0) + 1;
    }
    
    // If deal value is provided, update
    if (dealValue) {
      appointment.dealValue = dealValue;
      agent.stats.totalDealValue = (agent.stats.totalDealValue || 0) + dealValue;
    }
    
    // If closed with deal value, calculate reward (e.g., 2% commission)
    if (status === 'closed' && dealValue) {
      const rewardAmount = dealValue * 0.02;
      appointment.rewardEarned = rewardAmount;
      agent.rewards = (agent.rewards || 0) + rewardAmount;
      
      // Update conversion rate
      if (agent.stats.totalAppointments > 0) {
        const conversionRate = (agent.stats.completedVisits / agent.stats.totalAppointments) * 100;
        agent.stats.conversionRate = Math.round(conversionRate);
      }
    }
    
    // Add feedback ONLY if provided and has valid rating
    if (feedback && feedback.rating && feedback.rating >= 1 && feedback.rating <= 5) {
      appointment.feedback = {
        rating: feedback.rating,
        comment: feedback.comment || ''
      };
      
      // Update agent's overall rating - only if there are ratings
      const allRatings = agent.onboardedClients
        .filter(c => c.feedback && c.feedback.rating)
        .map(c => c.feedback.rating);
      
      if (allRatings.length > 0) {
        const avgRating = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
        agent.ratings.average = Math.min(Math.max(avgRating, 1), 5); // Ensure between 1 and 5
        agent.ratings.totalReviews = allRatings.length;
      }
    }
    
    await agent.save();
    
    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: {
        appointment,
        client: {
          id: client?._id,
          name: client?.name,
          email: client?.gmail,
          phoneNumber: client?.phoneNumber
        }
      }
    });
    
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment',
      error: error.message
    });
  }
};

// DELETE /api/bookings/appointments/:appointmentId
const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;
    
    // Find agent that has this appointment
    const agent = await Agent.findOne({
      'onboardedClients._id': appointmentId,
      'onboardedClients.client': userId
    });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    const appointment = agent.onboardedClients.id(appointmentId);
    appointment.status = 'cancelled';
    
    await agent.save();
    
    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully'
    });
    
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment',
      error: error.message
    });
  }
};

module.exports = {
  bookAppointment,
  getUserAppointments,
  getAgentAppointments,
  updateAppointmentStatus,
  cancelAppointment
};