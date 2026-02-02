const PropertyBatch = require('../models/PropertyBatch');
const PropertyUnit = require('../models/PropertyUnit');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

// @desc    Create a new property batch
// @route   POST /api/property-batches
// @access  Private
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
        
        // Validate property units exist and user has access
        if (parsedPropertyUnits.length > 0) {
          const query = { _id: { $in: parsedPropertyUnits } };
          
          // If user is not admin, only allow their own property units
          const isAdminUser = req.user.isAdmin || req.user.userType === 'superadmin' || req.user.userType === 'admin';
          if (!isAdminUser) {
            query.createdBy = req.user.id;
          }
          
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
// @access  Private/Public (based on isActive)
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
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    
    // Filter by active status (admin can see all)
    const isAdminUser = req.user?.isAdmin || req.user?.userType === 'superadmin' || req.user?.userType === 'admin';
    if (!isAdminUser) {
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
    
    // Filter by user if not admin
    if (!isAdminUser) {
      query.createdBy = req.user._id;
    }
    
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
        select: 'title price images city specifications.bedrooms specifications.bathrooms availability isFeatured',
        options: { limit: 5 } // Limit populated units for performance
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
// @access  Private
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
        select: '-createdBy -__v', // Exclude sensitive/unnecessary fields
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
    
    // Check access permissions
    const isAdminUser = req.user?.isAdmin || req.user?.userType === 'superadmin' || req.user?.userType === 'admin';
    const isOwner = batch.createdBy._id.toString() === req.user._id.toString();
    
    if (!isAdminUser && !isOwner && !batch.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to inactive batch'
      });
    }
    
    res.json({
      success: true,
      data: batch
    });
  } catch (error) {
    console.error('Error fetching batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching batch'
    });
  }
};

// @desc    Update property batch
// @route   PUT /api/property-batches/:id
// @access  Private
exports.updateBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    // console.log("hello")
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
    
    // Check permissions
    const isAdminUser = req.user?.isAdmin || req.user?.userType === 'superadmin' || req.user?.userType === 'admin';
    const isOwner = batch.createdBy.toString() === req.user._id.toString();
    
    if (!isAdminUser && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this batch'
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
        
        // Validate new property units
        if (parsedUnits.length > 0) {
          const query = { _id: { $in: parsedUnits } };
          
          if (!isAdminUser) {
            query.createdBy = req.user._id;
          }
          
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

// @desc    Delete property batch
// @route   DELETE /api/property-batches/:id
// @access  Private
exports.deleteBatch = async (req, res) => {
  try {
    const { id } = req.params;
    // console.log("hello")
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
    
    // Check permissions
    const isAdminUser = req.user?.isAdmin || 
                       req.user?.userType === 'superadmin' || 
                       req.user?.userType === 'admin';
    const isOwner = batch.createdBy.toString() === req.user._id.toString();
    
    if (!isAdminUser && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this batch'
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
    
    // Delete the batch
    await PropertyBatch.findByIdAndDelete(id);
    
    res.status(200).json({
      success: true,
      message: 'Property batch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting batch:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting batch',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Add property unit to batch
// @route   POST /api/property-batches/:id/add-unit
// @access  Private
exports.addPropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyUnitId } = req.body;
    
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
    
    // Check permissions
    const isAdminUser = req.user?.isAdmin || req.user?.userType === 'superadmin' || req.user?.userType === 'admin';
    const isOwner = batch.createdBy.toString() === req.user._id.toString();
    
    if (!isAdminUser && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this batch'
      });
    }
    
    // Check if property unit exists and user has access
    const query = { _id: propertyUnitId };
    if (!isAdminUser) {
      query.createdBy = req.user._id;
    }
    
    const propertyUnit = await PropertyUnit.findOne(query);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found or you do not have access'
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

// @desc    Remove property unit from batch
// @route   POST /api/property-batches/:id/remove-unit
// @access  Private
exports.removePropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyUnitId } = req.body;
    
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
    
    // Check permissions
    const isAdminUser = req.user?.isAdmin || req.user?.userType === 'superadmin' || req.user?.userType === 'admin';
    const isOwner = batch.createdBy.toString() === req.user._id.toString();
    
    if (!isAdminUser && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this batch'
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

// @desc    Get batches by location
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

// @desc    Toggle batch active status
// @route   PATCH /api/property-batches/:id/toggle-active
// @access  Private (Admin/Owner)
exports.toggleActiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
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
    
    // Only admin or owner can toggle status
    const isAdminUser = req.user?.isAdmin || req.user?.userType === 'superadmin' || req.user?.userType === 'admin';
    const isOwner = batch.createdBy.toString() === req.user._id.toString();
    
    if (!isAdminUser && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to change batch status'
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