const PropertyUnit = require("../models/PropertyUnit");
const User = require("../models/user");
const cloudinary = require("../config/cloudinary");
const mongoose = require('mongoose');
const createPropertyUnit = async (req, res) => {
  try {
    console.log('User making request:', req.user); // Debug log
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login to add property unit.'
      });
    }

    // Extract all fields from request body
    const {
      // Basic Information
      title,
      description,
      unitNumber,
      
      // Location
      city,
      address,
      coordinates,
         mapUrl, 
      // Price
      price,
      maintenanceCharges,
      securityDeposit,
      
      // Property Type
      propertyType,
      
      // Specifications (as JSON string)
      specifications,
      
      // Building Details
      buildingDetails,
      
      // Unit Features
      unitFeatures,
      
      // Rental Details
      rentalDetails,
      
      // Status & Approval
      approvalStatus, // Will be overridden based on user role
      isFeatured,     // Will be overridden based on user role
      isVerified,     // Will be overridden based on user role
      availability,
      listingType,
      
      // Website Assignment
      websiteAssignment,
      
      // Additional Info
      virtualTour,
      floorPlan,
      ownerDetails,
      legalDetails,
      viewingSchedule,
      contactPreference,
      metaTitle,
      metaDescription,
      displayOrder,
      
      // Parent Property
      parentProperty,
      
      // Rejection
      rejectionReason,
    } = req.body;

    // Check required fields
    if (!title || !city || !address || !price || !propertyType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, city, address, price, propertyType'
      });
    }

    // Validate property type
    const validPropertyTypes = [
      "Apartment",
      "Villa",
      "Independent House",
      "Studio",
      "Penthouse",
      "Duplex",
      "Row House",
      "Plot",
      "Commercial Space"
    ];
    
    if (!validPropertyTypes.includes(propertyType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid property type. Must be one of: ${validPropertyTypes.join(', ')}`
      });
    }

    // SECURITY: Determine sensitive fields based on user role
    const isAdminUser = req.user.isAdmin || req.user.userType === 'superadmin' || req.user.userType === 'admin';
    
    let finalApprovalStatus = "pending"; // Default for regular users
    let finalIsFeatured = false; // Default for regular users
    let finalIsVerified = false; // Default for regular users

    // Only allow admin users to set these sensitive fields
    if (isAdminUser) {
      // Admin can set approvalStatus
      if (approvalStatus && ["pending", "approved", "rejected"].includes(approvalStatus)) {
        finalApprovalStatus = approvalStatus;
      }
      
      // Admin can set isFeatured
      if (isFeatured !== undefined) {
        finalIsFeatured = isFeatured === 'true' || isFeatured === true;
      }
      
      // Admin can set isVerified
      if (isVerified !== undefined) {
        finalIsVerified = isVerified === 'true' || isVerified === true;
      }
    }
    // For non-admin users, always use default values regardless of what they send
    else {
      finalApprovalStatus = "pending";
      finalIsFeatured = false;
      finalIsVerified = false;
      
      // Log attempted security breach
      if (approvalStatus === "approved" || isFeatured === true || isFeatured === 'true' || isVerified === true || isVerified === 'true') {
        console.warn(`Security Alert: User ${req.user._id} attempted to set privileged fields without authorization`);
      }
    }

    // Upload images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "property-units",
          });
          uploadedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
            caption: ""
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading images to Cloudinary'
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }

    // Parse nested objects with error handling
    let parsedSpecifications = {};
    let parsedBuildingDetails = {};
    let parsedUnitFeatures = [];
    let parsedRentalDetails = {};
    let parsedCoordinates = {};
    let parsedOwnerDetails = {};
    let parsedLegalDetails = {};
    let parsedViewingSchedule = [];
    let parsedWebsiteAssignment = [];
    let parsedFloorPlan = {};

    try {
      parsedSpecifications = specifications ? JSON.parse(specifications) : {};
      parsedBuildingDetails = buildingDetails ? JSON.parse(buildingDetails) : {};
      parsedUnitFeatures = unitFeatures ? JSON.parse(unitFeatures) : [];
      parsedRentalDetails = rentalDetails ? JSON.parse(rentalDetails) : {};
      parsedCoordinates = coordinates ? JSON.parse(coordinates) : {};
      parsedOwnerDetails = ownerDetails ? JSON.parse(ownerDetails) : {};
      parsedLegalDetails = legalDetails ? JSON.parse(legalDetails) : {};
      parsedViewingSchedule = viewingSchedule ? JSON.parse(viewingSchedule) : [];
      parsedWebsiteAssignment = websiteAssignment ? JSON.parse(websiteAssignment) : ["cleartitle"];
      parsedFloorPlan = floorPlan ? JSON.parse(floorPlan) : {};
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in one of the fields'
      });
    }

    // Validate specifications based on property type
    const requiredSpecs = {
      'Apartment': ['bedrooms', 'bathrooms', 'carpetArea', 'builtUpArea'],
      'Villa': ['bedrooms', 'bathrooms', 'carpetArea', 'plotArea'],
      'Plot': ['plotArea'],
      'Commercial Space': ['carpetArea', 'builtUpArea']
    };

    const propertyTypeRequirements = requiredSpecs[propertyType] || ['bedrooms', 'bathrooms', 'carpetArea'];
    for (const spec of propertyTypeRequirements) {
      if (!parsedSpecifications[spec] && parsedSpecifications[spec] !== 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required specification: ${spec} for ${propertyType} property type`
        });
      }
    }

    // Parse price
    let parsedPrice = {};
    try {
      parsedPrice = JSON.parse(price);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price format. Must be valid JSON'
      });
    }

    // Validate listing type
    const validListingTypes = ["sale", "rent", "lease", "pg"];
    const finalListingType = listingType && validListingTypes.includes(listingType) ? listingType : "sale";

    // Create new property unit with SECURED fields
    const newPropertyUnit = new PropertyUnit({
      // Basic Information
      title,
      description,
      unitNumber,
      
      // Location
      city,
      address,
      coordinates: parsedCoordinates,
      mapUrl: mapUrl ? mapUrl.trim() : undefined, 
      // Price
      price: parsedPrice,
      maintenanceCharges: maintenanceCharges || 0,
      securityDeposit: securityDeposit || 0,
      
      // Property Type
      propertyType,
      
      // Specifications
      specifications: {
        bedrooms: parsedSpecifications.bedrooms || 0,
        bathrooms: parsedSpecifications.bathrooms || 0,
        balconies: parsedSpecifications.balconies || 0,
        floors: parsedSpecifications.floors || 1,
        floorNumber: parsedSpecifications.floorNumber,
        carpetArea: parsedSpecifications.carpetArea || 0,
        builtUpArea: parsedSpecifications.builtUpArea || 0,
        superBuiltUpArea: parsedSpecifications.superBuiltUpArea,
        plotArea: parsedSpecifications.plotArea,
        furnishing: parsedSpecifications.furnishing || "unfurnished",
        possessionStatus: parsedSpecifications.possessionStatus || "ready-to-move",
        ageOfProperty: parsedSpecifications.ageOfProperty,
        parking: {
          covered: parsedSpecifications.parking?.covered || 0,
          open: parsedSpecifications.parking?.open || 0
        },
        kitchenType: parsedSpecifications.kitchenType || "regular"
      },
      
      // Building Details
      buildingDetails: parsedBuildingDetails,
      
      // Unit Features
      unitFeatures: parsedUnitFeatures,
      
      // Rental Details
      rentalDetails: {
        availableForRent: parsedRentalDetails.availableForRent || (finalListingType === 'rent' || finalListingType === 'lease'),
        leaseDuration: parsedRentalDetails.leaseDuration || { value: 11, unit: "months" },
        rentNegotiable: parsedRentalDetails.rentNegotiable !== undefined ? parsedRentalDetails.rentNegotiable : true,
        preferredTenants: parsedRentalDetails.preferredTenants || ["any"],
        includedInRent: parsedRentalDetails.includedInRent || []
      },
      
      // Status & Approval
      approvalStatus: finalApprovalStatus,
      isFeatured: finalIsFeatured,
      isVerified: finalIsVerified,
      availability: availability || "available",
      listingType: finalListingType,
      
      // Website Assignment
      websiteAssignment: parsedWebsiteAssignment,
      
      // Images
      images: uploadedImages,
      
      // Additional Info
      virtualTour,
      floorPlan: parsedFloorPlan,
      ownerDetails: parsedOwnerDetails,
      legalDetails: parsedLegalDetails,
      viewingSchedule: parsedViewingSchedule,
      contactPreference: contactPreference ? JSON.parse(contactPreference) : ["call", "whatsapp"],
      metaTitle,
      metaDescription,
      displayOrder: displayOrder || 0,
      
      // Parent Property
      parentProperty,
      
      // Rejection
      rejectionReason: isAdminUser ? rejectionReason : "",
      
      // Creator
      createdBy: req.user._id,
    });

    // Save the property unit
    await newPropertyUnit.save();
    
    // ============ ADDED: Update user's postedProperties array ============
    try {
      // Find the user and update their postedProperties array
      const foundUser = await User.findById(req.user._id);
      if (foundUser) {
        // Check if property unit already exists in postedProperties (shouldn't, but just in case)
        const alreadyExists = foundUser.postedProperties.some(
          item => item.property && item.property.toString() === newPropertyUnit._id.toString()
        );
        
        if (!alreadyExists) {
          foundUser.postedProperties.push({
            property: newPropertyUnit._id,
            postedAt: newPropertyUnit.createdAt,
            status: 'active',
            type: 'propertyUnit'
          });
          await foundUser.save();
          console.log(`Property unit ${newPropertyUnit._id} added to user ${foundUser._id}'s postedProperties`);
          console.log('User postedProperties after update:', foundUser.postedProperties); // Debug log
        } else {
          console.log(`Property unit ${newPropertyUnit._id} already exists in user's postedProperties`);
        }
      } else {
        console.warn(`User ${req.user._id} not found when updating postedProperties`);
      }
    } catch (userUpdateError) {
      console.error('Error updating user postedProperties:', userUpdateError);
      // Don't fail the whole request if this fails, just log it
    }
    // ============ END OF ADDED CODE ============
    
    // Populate with correct field names
    await newPropertyUnit.populate('createdBy', 'name username email phoneNumber');

    // Dynamic success message based on approval status
    const successMessage = finalApprovalStatus === "approved" 
      ? "Property unit added successfully and approved! It is now live on the platform."
      : "Property unit added successfully! It will be visible after admin approval.";

    res.status(201).json({
      success: true,
      message: successMessage,
      propertyUnit: {
        ...newPropertyUnit.toObject(),
        // Don't send sensitive info about what was attempted vs what was set
      },
    });
  } catch (error) {
    console.error('Property unit creation error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Handle duplicate slug error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      return res.status(400).json({
        success: false,
        message: 'A property with similar title already exists'
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Error adding property unit",
      error: error.message 
    });
  }
};


// Get all property units
// In propertyUnitController.js
const getPropertyUnits = async (req, res) => {
  try {
    const {
      city,
      propertyType,
      bedrooms,
      bathrooms,
      minArea,
      maxArea,
      furnishing,
      possessionStatus,
      kitchenType,
      listingType,
      availability,
      isFeatured,
      isVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 10,
      limit = 200,
      search: searchQuery, // Renamed to avoid conflict
      approvalStatus,
      createdBy
    } = req.query;

    // Build filter
    const filter = {};

    // User type check
    const isAdmin = req.user && (req.user.userType === 'admin' || req.user.userType === 'superadmin');

    // Set default filters for non-admin users
    if (!isAdmin) {
      filter.approvalStatus = 'approved';
      filter.availability = 'available';
    } else {
      // Admin can see all properties
      if (approvalStatus) {
        filter.approvalStatus = approvalStatus;
      }
      if (availability) {
        filter.availability = availability;
      }
    }

    // Apply basic filters
    if (city && city.trim() !== '') {
      filter.city = new RegExp(city.trim(), 'i');
    }
    
    if (propertyType && propertyType.trim() !== '') {
      filter.propertyType = propertyType.trim();
    }
    
    if (listingType && listingType.trim() !== '') {
      filter.listingType = listingType.trim();
    }
    
    // Specifications filters
    if (furnishing && furnishing.trim() !== '') {
      filter['specifications.furnishing'] = furnishing.trim();
    }
    
    if (possessionStatus && possessionStatus.trim() !== '') {
      filter['specifications.possessionStatus'] = possessionStatus.trim();
    }
    
    if (kitchenType && kitchenType.trim() !== '') {
      filter['specifications.kitchenType'] = kitchenType.trim();
    }
    
    // Admin-only filters
    if (isAdmin) {
      if (isFeatured !== undefined && isFeatured !== '') {
        filter.isFeatured = isFeatured === 'true';
      }
      if (isVerified !== undefined && isVerified !== '') {
        filter.isVerified = isVerified === 'true';
      }
    }
    
    // Numeric filters
    if (bedrooms && !isNaN(bedrooms)) {
      filter['specifications.bedrooms'] = Number(bedrooms);
    }
    
    if (bathrooms && !isNaN(bathrooms)) {
      filter['specifications.bathrooms'] = Number(bathrooms);
    }
    
    // Area filter
    if (minArea || maxArea) {
      filter['specifications.carpetArea'] = {};
      if (minArea && !isNaN(minArea)) {
        filter['specifications.carpetArea'].$gte = Number(minArea);
      }
      if (maxArea && !isNaN(maxArea)) {
        filter['specifications.carpetArea'].$lte = Number(maxArea);
      }
    }
    
    // Search filter - using searchQuery instead of search
    if (searchQuery && searchQuery.trim() !== '') {
      const searchRegex = new RegExp(searchQuery.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { address: searchRegex },
        { city: searchRegex },
        { 'buildingDetails.name': searchRegex },
        { mapUrl: searchRegex }
      ];
    }
    
    // Filter by creator
    if (createdBy && createdBy.trim() !== '') {
      filter.createdBy = createdBy.trim();
    }

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 10), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sort = {};
    
    // Define allowed sort fields
    const allowedSortFields = {
      'createdAt': 'createdAt',
      'updatedAt': 'updatedAt',
      'title': 'title',
      'city': 'city',
      'price': 'price',
      'listingType': 'listingType',
      'isFeatured': 'isFeatured',
      'isVerified': 'isVerified',
      'availability': 'availability',
      'bedrooms': 'specifications.bedrooms',
      'carpetArea': 'specifications.carpetArea'
    };

    // Get the sort field from allowed fields or default to createdAt
    const sortField = allowedSortFields[sortBy] || 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    // Set the sort field
    sort[sortField] = sortDirection;
    
    // Only add isFeatured to sort if we're not already sorting by it
    if (sortField !== 'isFeatured') {
      sort.isFeatured = -1; // Show featured first
    }

    console.log('Sort configuration:', JSON.stringify(sort));
    console.log('Filter:', JSON.stringify(filter));
    console.log('Skip:', skip, 'Limit:', limitNum);

    // Execute query
    const query = PropertyUnit.find(filter);
    
    // Apply sort - ensure it's a valid object
    if (Object.keys(sort).length > 0) {
      query.sort(sort);
    }
    
    const propertyUnits = await query
      .skip(skip)
      .limit(limitNum)
      .populate('createdBy', 'name email phoneNumber avatar')
      .populate('parentProperty', 'name title images')
      .lean();

    // Get total count
    const total = await PropertyUnit.countDocuments(filter);

    // Get available filters
    const availableCities = await PropertyUnit.distinct('city', filter).sort();
    const availablePropertyTypes = await PropertyUnit.distinct('propertyType', filter).sort();
    const availableBedrooms = await PropertyUnit.distinct('specifications.bedrooms', filter)
      .then(beds => beds.filter(b => b != null).sort((a, b) => a - b));

    res.status(200).json({
      success: true,
      count: propertyUnits.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: propertyUnits,
      filters: {
        availableCities,
        availablePropertyTypes,
        availableBedrooms,
        appliedFilters: {
          city,
          propertyType,
          bedrooms,
          bathrooms,
          furnishing,
          possessionStatus,
          listingType
        }
      }
    });

  } catch (error) {
    console.error('Get property units error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error fetching property units',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
// Update property unit
const updatePropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find property unit
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    // Check permissions
    const isOwner = req.user._id.equals(propertyUnit.createdBy);
    const isAdmin = req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property unit'
      });
    }

    // Extract update data
    const updateData = { ...req.body };

    // Admin-only fields
    const adminFields = ['approvalStatus', 'isFeatured', 'isVerified', 'rejectionReason'];
    if (!isAdmin) {
      for (const field of adminFields) {
        if (updateData[field] !== undefined) {
          delete updateData[field];
        }
      }
    }

    // If admin is rejecting, require rejection reason
    if (isAdmin && updateData.approvalStatus === 'rejected' && !updateData.rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting a property unit'
      });
    }

    // Handle image uploads if new images are provided
    if (req.files && req.files.length > 0) {
      const newImages = [];
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "property-units",
          });
          newImages.push({
            url: result.secure_url,
            public_id: result.public_id,
            caption: ""
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
        }
      }
      
      // Add new images to existing ones
      if (newImages.length > 0) {
        updateData.images = [...propertyUnit.images, ...newImages];
      }
    }

    // Parse JSON fields if they're strings
    const parseIfString = (field) => {
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch (e) {
          return field;
        }
      }
      return field;
    };

    // Parse all potential JSON fields
    if (updateData.specifications) updateData.specifications = parseIfString(updateData.specifications);
    if (updateData.buildingDetails) updateData.buildingDetails = parseIfString(updateData.buildingDetails);
    if (updateData.unitFeatures) updateData.unitFeatures = parseIfString(updateData.unitFeatures);
    if (updateData.rentalDetails) updateData.rentalDetails = parseIfString(updateData.rentalDetails);
    if (updateData.coordinates) updateData.coordinates = parseIfString(updateData.coordinates);
    if (updateData.agentDetails) updateData.agentDetails = parseIfString(updateData.agentDetails);
    if (updateData.ownerDetails) updateData.ownerDetails = parseIfString(updateData.ownerDetails);
    if (updateData.legalDetails) updateData.legalDetails = parseIfString(updateData.legalDetails);
    if (updateData.viewingSchedule) updateData.viewingSchedule = parseIfString(updateData.viewingSchedule);
    if (updateData.websiteAssignment) updateData.websiteAssignment = parseIfString(updateData.websiteAssignment);
    if (updateData.floorPlan) updateData.floorPlan = parseIfString(updateData.floorPlan);

    // Update property unit
    const updatedPropertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email phoneNumber');

    // If approval status changed to approved, log it
    if (updateData.approvalStatus === 'approved' && propertyUnit.approvalStatus !== 'approved') {
      console.log(`Property unit ${id} approved by admin ${req.user._id}`);
    }

    res.status(200).json({
      success: true,
      message: 'Property unit updated successfully',
      data: updatedPropertyUnit
    });

  } catch (error) {
    console.error('Update property unit error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating property unit',
      error: error.message
    });
  }
};

// Delete property unit
const deletePropertyUnit = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find property unit
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: 'Property unit not found'
      });
    }

    // Check permissions
    const isOwner = req.user._id.equals(propertyUnit.createdBy);
    const isAdmin = req.user.userType === 'admin' || req.user.userType === 'superadmin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this property unit'
      });
    }

    // Delete images from Cloudinary
    if (propertyUnit.images && propertyUnit.images.length > 0) {
      for (const image of propertyUnit.images) {
        if (image.public_id) {
          try {
            await cloudinary.uploader.destroy(image.public_id);
          } catch (cloudinaryError) {
            console.error('Error deleting image from Cloudinary:', cloudinaryError);
          }
        }
      }
    }

    // Delete floor plan from Cloudinary if exists
    if (propertyUnit.floorPlan && propertyUnit.floorPlan.public_id) {
      try {
        await cloudinary.uploader.destroy(propertyUnit.floorPlan.public_id);
      } catch (error) {
        console.error('Error deleting floor plan from Cloudinary:', error);
      }
    }

    // Delete from database
    await PropertyUnit.findByIdAndDelete(id);

    // Remove from user's postedProperties
    await User.findByIdAndUpdate(
      propertyUnit.createdBy,
      { $pull: { postedProperties: { property: id } } }
    );

    res.status(200).json({
      success: true,
      message: 'Property unit deleted successfully'
    });

  } catch (error) {
    console.error('Delete property unit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting property unit',
      error: error.message
    });
  }
};
const getPropertyUnitById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID format"
      });
    }

    console.log("Searching for property unit with ID:", id); // Debug log

    // Find property unit - remove approvalStatus filter temporarily for debugging
    const propertyUnit = await PropertyUnit.findOne({
      _id: id
      // Remove filters temporarily:
      // approvalStatus: "approved",
      // availability: "available"
    })
      .populate("parentProperty", "name title images")
      .populate("createdBy", "name email phoneNumber avatar")
      .lean();

    console.log("Found property unit:", propertyUnit ? "Yes" : "No"); // Debug log

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    // Increment view count asynchronously
    PropertyUnit.findByIdAndUpdate(id, { 
      $inc: { viewCount: 1 } 
    }).exec();

    // REMOVED: All price per sqft calculations

    // Format response - simplified
    const response = {
      success: true,
      data: {
        ...propertyUnit,
        // Add virtual fields
        fullAddress: propertyUnit.unitNumber 
          ? `${propertyUnit.unitNumber}, ${propertyUnit.address || ''}, ${propertyUnit.city || ''}`.replace(/\s*,\s*,/g, ',').replace(/,\s*$/, '')
          : `${propertyUnit.address || ''}, ${propertyUnit.city || ''}`.replace(/\s*,\s*,/g, ',').replace(/,\s*$/, '')
      }
    };

    console.log("Sending response for:", response.data.title); // Debug log
    res.status(200).json(response);
    
  } catch (error) {
    console.error("Get property unit by ID error:", error);
    console.error("Error stack:", error.stack);
    
    // Handle specific errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Error fetching property unit",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  createPropertyUnit,
  getPropertyUnits,
getPropertyUnitById,
  updatePropertyUnit,
  deletePropertyUnit
};