const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  // REMOVED slug field completely

  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  
  // Image (using your existing Cloudinary setup)
  image: {
    url: String,
    public_id: String,
    altText: String
  },
  
  // SEO Fields
  metaDescription: String,
  keywords: [String],
  
  // Relations
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'published'
  },
  
  // Stats
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// REMOVED the pre-save hook (no longer needed)

module.exports = mongoose.model('Blog', blogSchema);