const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['new', 'in-progress', 'resolved', 'closed'],
    default: 'new'
  }
}, {
  timestamps: true
});

// Index for better query performance
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ user: 1 });
enquirySchema.index({ status: 1 });

module.exports = mongoose.model('Enquiry', enquirySchema);