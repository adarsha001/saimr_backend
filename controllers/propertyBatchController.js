const PropertyBatch = require('../models/PropertyBatch');
const PropertyUnit = require('../models/PropertyUnit');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// Helper function to check if user is admin
const isAdminUser = (user) => {
  return user?.isAdmin || user?.userType === 'superadmin' || user?.userType === 'admin';
};

// @desc    Create a new property batch (Admin only)
// @route   POST /api/property-batches
// @access  Private/Admin
exports.createBatch = async (req, res) => {
  try {
    console.log('User making request:', req.user); // Debug log
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login to create batch'
      });
    }

    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can create batches.'
      });
    }

    const {
      batchName,
      locationName,
      description,
      image, // This can be URL or file will be uploaded
      propertyUnits = [],
      batchType = 'location_based',
      tags = [],
      locationCoordinates,
      isActive = true,
      displayOrder = 0
    } = req.body;

    // Check required fields
    if (!batchName || !locationName) {
      return res.status(400).json({
        success: false,
        message: 'Batch name and location name are required'
      });
    }

    // Validate batch type
    const validBatchTypes = [
      "location_based",
      "project_group",
      "featured_listings",
      "similar_properties",
      "comparison_group"
    ];
    
    if (!validBatchTypes.includes(batchType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid batch type. Must be one of: ${validBatchTypes.join(', ')}`
      });
    }

    // IMAGE HANDLING: Check if image is provided
    let uploadedImage = null;
    
    if (req.file) {
      // Upload file to Cloudinary
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "property_batches",
        });
        
        uploadedImage = {
          url: result.secure_url,
          public_id: result.public_id,
          caption: image?.caption || req.body.imageCaption || ''
        };
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to Cloudinary'
        });
      }
    } else if (image && image.url) {
      // Use provided image URL
      uploadedImage = {
        url: image.url,
        public_id: image.public_id || '',
        caption: image.caption || req.body.imageCaption || ''
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Image is required. Please provide an image file or URL'
      });
    }

    // Parse property units if they come as string
    let parsedPropertyUnits = [];
    if (propertyUnits && propertyUnits.length > 0) {
      try {
        // If propertyUnits is a string (JSON array), parse it
        if (typeof propertyUnits === 'string') {
          parsedPropertyUnits = JSON.parse(propertyUnits);
        } else {
          parsedPropertyUnits = propertyUnits;
        }
        
        // Validate property units exist (admin has access to all)
        if (parsedPropertyUnits.length > 0) {
          const query = { _id: { $in: parsedPropertyUnits } };
          
          const validUnits = await PropertyUnit.find(query).select('_id');
          const validUnitIds = validUnits.map(unit => unit._id.toString());
          
          // Check if any invalid property units
          const invalidUnits = parsedPropertyUnits.filter(unitId => 
            !validUnitIds.includes(unitId.toString())
          );
          
          if (invalidUnits.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Invalid property units: ${invalidUnits.join(', ')}`,
              validUnits: validUnitIds
            });
          }
        }
      } catch (parseError) {
        console.error('Property units parse error:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid property units format'
        });
      }
    }

    // Parse location coordinates if provided
    let parsedCoordinates = {};
    if (locationCoordinates) {
      try {
        parsedCoordinates = typeof locationCoordinates === 'string' 
          ? JSON.parse(locationCoordinates) 
          : locationCoordinates;
      } catch (parseError) {
        console.error('Coordinates parse error:', parseError);
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates format'
        });
      }
    }

    // Parse tags if they come as string
    let parsedTags = [];
    if (tags && tags.length > 0) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (parseError) {
        console.error('Tags parse error:', parseError);
        // Continue with empty tags if parsing fails
        parsedTags = [];
      }
    }

    // Create new batch
    const batch = new PropertyBatch({
      batchName,
      locationName,
      description,
      image: uploadedImage,
      propertyUnits: parsedPropertyUnits,
      batchType,
      locationCoordinates: parsedCoordinates,
      tags: parsedTags,
      isActive: isActive === 'true' || isActive === true,
      displayOrder: parseInt(displayOrder) || 0,
      createdBy: req.user._id
    });

    // Save the batch
    await batch.save();
    
    // Populate basic creator info
    await batch.populate('createdBy', 'name email username');

    res.status(201).json({
      success: true,
      data: batch,
      message: 'Property batch created successfully'
    });
  } catch (error) {
    console.error('Error creating batch:', error);
    
    // Handle duplicate batch code error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.batchCode) {
      return res.status(400).json({
        success: false,
        message: 'Batch code already exists. Please try again or use a different name.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
};

// @desc    Get all property batches
// @route   GET /api/property-batches
// @access  Private (users see active only, admin sees all with showAll flag)
exports.getAllBatches = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      location, 
      batchType, 
      tags,
      search,
      isActive = true,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      showAll = false // Admin flag to show all batches
    } = req.query;
    
    const query = {};
    
    // Check if user is admin
    const adminUser = isAdminUser(req.user);
    
    // Regular users can only see active batches
    // Admin can see all if showAll flag is true
    if (!adminUser || !showAll) {
      query.isActive = isActive === 'true';
    }
    
    // Filter by location
    if (location) {
      query.locationName = new RegExp(location, 'i');
    }
    
    // Filter by batch type
    if (batchType) {
      query.batchType = batchType;
    }
    
    // Filter by tags
    if (tags) {
      const tagsArray = tags.split(',');
      query.tags = { $in: tagsArray };
    }
    
    // Search across multiple fields
    if (search) {
      query.$or = [
        { batchName: new RegExp(search, 'i') },
        { locationName: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { batchCode: new RegExp(search, 'i') }
      ];
    }
    
    // Regular users see all active batches (no user filter)
    // Admin sees all batches
    
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;
    
    // Sort configuration
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const batches = await PropertyBatch.find(query)
      .populate('createdBy', 'name email username')
      .populate({
        path: 'propertyUnits',
        select: 'title price images city specifications.bedrooms specifications.bathrooms availability isFeatured approvalStatus',
        match: { 
          // For regular users, only show approved and available properties
          ...(!adminUser && { 
            approvalStatus: 'approved',
            availability: 'available'
          })
        },
        options: { limit: 5 }
      })
      .sort(sort)
      .skip(skip)
      .limit(limitInt);
    
    const total = await PropertyBatch.countDocuments(query);
    
    res.json({
      success: true,
      data: batches,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total,
        pages: Math.ceil(total / limitInt)
      },
      // Add metadata about user type
      meta: {
        isAdmin: adminUser,
        showAll: adminUser && showAll
      }
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batches'
    });
  }
};

// @desc    Get single property batch
// @route   GET /api/property-batches/:id
// @access  Private (users see active only, admin sees all)
exports.getBatch = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id)
      .populate('createdBy', 'name email username')
      .populate({
        path: 'propertyUnits',
        select: '-createdBy -__v',
        populate: {
          path: 'createdBy',
          select: 'name email phoneNumber'
        }
      });
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    // Check if user is admin
    const adminUser = isAdminUser(req.user);
    
    // Regular users can only see active batches
    if (!adminUser && !batch.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to inactive batch'
      });
    }
    
    // Filter property units for regular users (only show approved/available)
    if (!adminUser && batch.propertyUnits) {
      batch.propertyUnits = batch.propertyUnits.filter(unit => 
        unit.approvalStatus === 'approved' && unit.availability === 'available'
      );
    }
    
    res.json({
      success: true,
      data: batch,
      meta: {
        isAdmin: adminUser
      }
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batch'
    });
  }
};

// @desc    Update property batch (Admin only)
// @route   PUT /api/property-batches/:id
// @access  Private/Admin
exports.updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can update batches.'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    // Find the batch
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    // Handle image update
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (batch.image && batch.image.public_id) {
          await cloudinary.uploader.destroy(batch.image.public_id);
        }
        
        // Upload new image
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "property_batches",
        });
        
        updates.image = {
          url: result.secure_url,
          public_id: result.public_id,
          caption: updates.imageCaption || batch.image?.caption || ''
        };
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error updating image'
        });
      }
    } else if (updates.image && updates.image.url && !updates.image.public_id) {
      // If updating image URL without file, keep existing public_id if not provided
      updates.image = {
        url: updates.image.url,
        public_id: batch.image?.public_id || '',
        caption: updates.image.caption || batch.image?.caption || ''
      };
    }
    
    // Handle property units update
    if (updates.propertyUnits) {
      try {
        let parsedUnits = updates.propertyUnits;
        if (typeof parsedUnits === 'string') {
          parsedUnits = JSON.parse(parsedUnits);
        }
        
        // Validate new property units (admin has access to all)
        if (parsedUnits.length > 0) {
          const query = { _id: { $in: parsedUnits } };
          
          const validUnits = await PropertyUnit.find(query).select('_id');
          const validUnitIds = validUnits.map(unit => unit._id.toString());
          
          // Check if any invalid property units
          const invalidUnits = parsedUnits.filter(unitId => 
            !validUnitIds.includes(unitId.toString())
          );
          
          if (invalidUnits.length > 0) {
            return res.status(400).json({
              success: false,
              message: `Invalid property units: ${invalidUnits.join(', ')}`
            });
          }
        }
        
        updates.propertyUnits = parsedUnits;
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid property units format'
        });
      }
    }
    
    // Update the batch
    Object.keys(updates).forEach(key => {
      batch[key] = updates[key];
    });
    
    batch.updatedAt = Date.now();
    await batch.save();
    
    // Populate updated data
    await batch.populate('createdBy', 'name email username');
    
    res.json({
      success: true,
      data: batch,
      message: 'Property batch updated successfully'
    });
  } catch (error) {
    console.error('Error updating batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating batch'
    });
  }
};

// @desc    Delete property batch (Admin only)
// @route   DELETE /api/property-batches/:id
// @access  Private/Admin
exports.deleteBatch = async (req, res) => { 
  try {
    const { id } = req.params;
    
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can delete batches.'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    // Delete image from Cloudinary if exists
    if (batch.image && batch.image.public_id) {
      try {
        await cloudinary.uploader.destroy(batch.image.public_id);
      } catch (cloudinaryError) {
        console.error('Error deleting image from Cloudinary:', cloudinaryError);
        // Continue with deletion even if image deletion fails
      }
    }
    
    // Optionally: Remove references to this batch from property units
    if (batch.propertyUnits && batch.propertyUnits.length > 0) {
      await PropertyUnit.updateMany(
        { _id: { $in: batch.propertyUnits } },
        { $pull: { batches: batch._id } }
      );
    }
    
    // Delete the batch
    await PropertyBatch.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Property batch deleted successfully',
      data: {
        id: id,
        batchName: batch.batchName,
        locationName: batch.locationName
      }
    });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting batch'
    });
  }
};

// @desc    Add property unit to batch (Admin only)
// @route   POST /api/property-batches/:id/add-unit
// @access  Private/Admin
exports.addPropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyUnitId } = req.body;
    
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can modify batches.'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(propertyUnitId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID or property unit ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    // Check if property unit exists (admin has access to all)
    const propertyUnit = await PropertyUnit.findById(propertyUnitId);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }
    
    // Add property unit to batch
    const added = batch.addPropertyUnit(propertyUnitId);
    if (!added) {
      return res.status(400).json({
        success: false,
        message: 'Property unit already exists in batch'
      });
    }
    
    await batch.save();
    
    res.json({
      success: true,
      data: batch,
      message: 'Property unit added to batch successfully'
    });
  } catch (error) {
    console.error('Error adding property unit:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding property unit'
    });
  }
};

// @desc    Remove property unit from batch (Admin only)
// @route   POST /api/property-batches/:id/remove-unit
// @access  Private/Admin
exports.removePropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyUnitId } = req.body;
    
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can modify batches.'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(propertyUnitId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID or property unit ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    // Remove property unit from batch
    const removed = batch.removePropertyUnit(propertyUnitId);
    if (!removed) {
      return res.status(400).json({
        success: false,
        message: 'Property unit not found in batch'
      });
    }
    
    await batch.save();
    
    res.json({
      success: true,
      data: batch,
      message: 'Property unit removed from batch successfully'
    });
  } catch (error) {
    console.error('Error removing property unit:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing property unit'
    });
  }
};

// @desc    Get batches by location (Public)
// @route   GET /api/property-batches/location/:location
// @access  Public
exports.getBatchesByLocation = async (req, res) => {
  try {
    const { location } = req.params;
    const { limit = 10 } = req.query;
    
    const batches = await PropertyBatch.find({
      locationName: new RegExp(location, 'i'),
      isActive: true
    })
    .populate('createdBy', 'name email')
    .populate({
      path: 'propertyUnits',
      select: 'title price images city specifications.bedrooms',
      match: { approvalStatus: 'approved', availability: 'available' },
      options: { limit: 3 }
    })
    .limit(parseInt(limit))
    .sort({ displayOrder: 1, createdAt: -1 });
    
    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error fetching batches by location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batches by location'
    });
  }
};

// @desc    Toggle batch active status (Admin only)
// @route   PATCH /api/property-batches/:id/toggle-active
// @access  Private/Admin
exports.toggleActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is admin
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators can change batch status.'
      });
    }
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid batch ID'
      });
    }
    
    const batch = await PropertyBatch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Property batch not found'
      });
    }
    
    // Toggle active status
    batch.isActive = !batch.isActive;
    await batch.save();
    
    res.json({
      success: true,
      data: batch,
      message: `Batch ${batch.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling batch status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling batch status'
    });
  }
};