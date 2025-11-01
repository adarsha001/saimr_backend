const mongoose = require('mongoose');

const clickAnalyticsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow anonymous clicks
  },
  userName: {
    type: String,
    required: false // Store user's name when logged in
  },
  sessionId: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    required: true,
    enum: ['phone', 'email', 'instagram', 'twitter', 'facebook', 'linkedin', 'whatsapp', 'website',"location", 'other']
  },
  itemValue: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: false
  },
  pageUrl: {
    type: String,
    required: true
  },
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  },
  country: {
    type: String
  },
  city: {
    type: String
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet'],
    default: 'desktop'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for better query performance
clickAnalyticsSchema.index({ itemType: 1, timestamp: -1 });
clickAnalyticsSchema.index({ userId: 1, timestamp: -1 });
clickAnalyticsSchema.index({ sessionId: 1 });
clickAnalyticsSchema.index({ propertyId: 1 });
clickAnalyticsSchema.index({ timestamp: -1 });

module.exports = mongoose.model('ClickAnalytics', clickAnalyticsSchema);