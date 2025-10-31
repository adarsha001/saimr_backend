const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  itemType: {
    type: String,
    required: true,
    enum: ['phone', 'email', 'website', 'social', 'navigation', 'service', 'legal']
  },
  itemValue: {
    type: String,
    required: true
  },
  clickCount: {
    type: Number,
    default: 0
  },
  firstClicked: {
    type: Date,
    default: Date.now
  },
  lastClicked: {
    type: Date,
    default: Date.now
  },
  displayName: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
clickSchema.index({ itemType: 1, itemValue: 1 }, { unique: true });

// Check if model already exists before creating it
module.exports = mongoose.models.Click || mongoose.model('Click', clickSchema);