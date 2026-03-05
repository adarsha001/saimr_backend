
const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  
  // Q&A Format
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

// Create slug from title before saving
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

module.exports = mongoose.model('Blog', blogSchema);