const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  propertyUnit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PropertyUnit',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one like per user per property
LikeSchema.index({ user: 1, propertyUnit: 1 }, { unique: true });

// Static method to get count of likes for a property
LikeSchema.statics.getLikeCount = async function(propertyUnitId) {
  const count = await this.countDocuments({ propertyUnit: propertyUnitId });
  return count;
};

// Static method to check if a user has liked a property
LikeSchema.statics.hasLiked = async function(userId, propertyUnitId) {
  const like = await this.findOne({ 
    user: userId, 
    propertyUnit: propertyUnitId 
  });
  return !!like;
};

// Static method to get user's liked properties
LikeSchema.statics.getUserLikes = async function(userId) {
  return await this.find({ user: userId })
    .populate('propertyUnit', 'title city price images propertyType listingType')
    .sort('-createdAt');
};

module.exports = mongoose.model('Like', LikeSchema);