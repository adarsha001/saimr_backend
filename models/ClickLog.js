const mongoose = require('mongoose');

const clickLogSchema = new mongoose.Schema({
  itemType: {
    type: String,
    required: true
  },
  itemValue: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: false
  },
  page: {
    type: String,
    required: false
  },
  ipAddress: {
    type: String,
    required: false
  },
  referrer: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
clickLogSchema.index({ itemType: 1, itemValue: 1 });
clickLogSchema.index({ timestamp: -1 });

// Check if model already exists before creating it
module.exports = mongoose.models.ClickLog || mongoose.model('ClickLog', clickLogSchema);