const PropertyUnit = require("../models/PropertyUnit");
const User = require("../models/user");
const cloudinary = require("../config/cloudinary");
const mongoose = require('mongoose');

// Create property unit (Public)
const createPropertyUnit = async (req, res) => {
  try {
    console.log('User making request:', req.user);
    
    // Check if user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated. Please login to add property unit.'
      });
    }

    // Extract all fields from request body
    const {
      title,
      description,
      unitNumber,
      city,
      address,
      coordinates,
      mapUrl,
      price,
      maintenanceCharges,
      securityDeposit,
      propertyType,
      specifications,
      buildingDetails,
      unitFeatures,
      rentalDetails,
      approvalStatus,
      isFeatured,
      isVerified,
      availability,
      listingType,
      websiteAssignment,
      virtualTour,
      floorPlan,
      ownerDetails,
      legalDetails,
      viewingSchedule,
      contactPreference,
      metaTitle,
      metaDescription,
      displayOrder,
      parentProperty,
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
      "Pg house",
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
    
    let finalApprovalStatus = "pending";
    let finalIsFeatured = false;
    let finalIsVerified = false;

    // Only allow admin users to set these sensitive fields
    if (isAdminUser) {
      if (approvalStatus && ["pending", "approved", "rejected"].includes(approvalStatus)) {
        finalApprovalStatus = approvalStatus;
      }
      
      if (isFeatured !== undefined) {
        finalIsFeatured = isFeatured === 'true' || isFeatured === true;
      }
      
      if (isVerified !== undefined) {
        finalIsVerified = isVerified === 'true' || isVerified === true;
      }
    }
    // For non-admin users, always use default values
    else {
      finalApprovalStatus = "pending";
      finalIsFeatured = false;
      finalIsVerified = false;
      
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

    // Create new property unit
    const newPropertyUnit = new PropertyUnit({
      title,
      description,
      unitNumber,
      city,
      address,
      coordinates: parsedCoordinates,
      mapUrl: mapUrl ? mapUrl.trim() : undefined,
      price: parsedPrice,
      maintenanceCharges: maintenanceCharges || 0,
      securityDeposit: securityDeposit || 0,
      propertyType,
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
      buildingDetails: parsedBuildingDetails,
      unitFeatures: parsedUnitFeatures,
      rentalDetails: {
        availableForRent: parsedRentalDetails.availableForRent || (finalListingType === 'rent' || finalListingType === 'lease'),
        leaseDuration: parsedRentalDetails.leaseDuration || { value: 11, unit: "months" },
        rentNegotiable: parsedRentalDetails.rentNegotiable !== undefined ? parsedRentalDetails.rentNegotiable : true,
        preferredTenants: parsedRentalDetails.preferredTenants || ["any"],
        includedInRent: parsedRentalDetails.includedInRent || []
      },
      approvalStatus: finalApprovalStatus,
      isFeatured: finalIsFeatured,
      isVerified: finalIsVerified,
      availability: availability || "available",
      listingType: finalListingType,
      websiteAssignment: parsedWebsiteAssignment,
      images: uploadedImages,
      virtualTour,
      floorPlan: parsedFloorPlan,
      ownerDetails: parsedOwnerDetails,
      legalDetails: parsedLegalDetails,
      viewingSchedule: parsedViewingSchedule,
      contactPreference: contactPreference ? JSON.parse(contactPreference) : ["call", "whatsapp"],
      metaTitle,
      metaDescription,
      displayOrder: displayOrder || 0,
      parentProperty,
      rejectionReason: isAdminUser ? rejectionReason : "",
      createdBy: req.user._id,
    });

    // Save the property unit
    await newPropertyUnit.save();
    
    // Update user's postedProperties array
    try {
      const foundUser = await User.findById(req.user._id);
      if (foundUser) {
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
        } else {
          console.log(`Property unit ${newPropertyUnit._id} already exists in user's postedProperties`);
        }
      } else {
        console.warn(`User ${req.user._id} not found when updating postedProperties`);
      }
    } catch (userUpdateError) {
      console.error('Error updating user postedProperties:', userUpdateError);
    }
    
    await newPropertyUnit.populate('createdBy', 'name username email phoneNumber');

    const successMessage = finalApprovalStatus === "approved" 
      ? "Property unit added successfully and approved! It is now live on the platform."
      : "Property unit added successfully! It will be visible after admin approval.";

    res.status(201).json({
      success: true,
      message: successMessage,
      propertyUnit: newPropertyUnit.toObject(),
    });
  } catch (error) {
    console.error('Property unit creation error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

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

// Get all property units (Public)
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
      sortBy = 'displayOrder', // Changed default to displayOrder
      sortOrder = 'asc', // Changed default to asc for displayOrder
      page = 1,
      limit = 12,
      search: searchQuery,
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
    
    // Search filter
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
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 12), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sort = {};
    
    const allowedSortFields = {
      'displayOrder': 'displayOrder', // Added this
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

    const sortField = allowedSortFields[sortBy] || 'displayOrder'; // Changed default to displayOrder
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    // If sorting by displayOrder, always put null values at the end
    if (sortField === 'displayOrder') {
      sort = { 
        [sortField]: sortDirection,
        'createdAt': -1 // Secondary sort for items without displayOrder
      };
    } else {
      sort[sortField] = sortDirection;
      // Add displayOrder as secondary sort for other fields
      sort.displayOrder = -1;
    }
    
    // If not sorting by isFeatured, add it as a sort criteria
    if (sortField !== 'isFeatured') {
      sort.isFeatured = -1;
    }

    // Execute query
    const query = PropertyUnit.find(filter);
    
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

    // Also get other filter options
    const availableFurnishingTypes = await PropertyUnit.distinct('specifications.furnishing', filter);
    const availablePossessionStatuses = await PropertyUnit.distinct('specifications.possessionStatus', filter);
    const availableKitchenTypes = await PropertyUnit.distinct('specifications.kitchenType', filter);
    const availableListingTypes = await PropertyUnit.distinct('listingType', filter);

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
        availableFurnishingTypes,
        availablePossessionStatuses,
        availableKitchenTypes,
        availableListingTypes,
        appliedFilters: {
          city,
          propertyType,
          bedrooms,
          bathrooms,
          furnishing,
          possessionStatus,
          kitchenType,
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


const getFeaturedPropertyUnits = async (req, res) => {
  try {
    // Get query parameters with defaults
    const {
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50
    } = req.query;

    // Build sort object
    let sort = {};
    if (sortBy === 'displayOrder') {
      sort.displayOrder = 1;
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      // Add secondary sort by displayOrder
      sort.displayOrder = 1;
    }

    // Convert limit to number
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);

    // Get only featured, approved, and available properties
    const propertyUnits = await PropertyUnit.find({
      isFeatured: true,
      approvalStatus: "approved",
      availability: "available"
    })
    .sort(sort)
    .limit(limitNum)
    .populate("createdBy", "name email phoneNumber avatar")
    .populate("parentProperty", "name title images")
    .lean();

    res.status(200).json({
      success: true,
      count: propertyUnits.length,
      data: propertyUnits
    });

  } catch (error) {
    console.error("Get featured property units error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching featured property units",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Get property unit by ID (Public)
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

    console.log("Searching for property unit with ID:", id);

    // Find property unit
    const propertyUnit = await PropertyUnit.findOne({
      _id: id
    })
      .populate("parentProperty", "name title images")
      .populate("createdBy", "name email phoneNumber avatar")
      .lean();

    console.log("Found property unit:", propertyUnit ? "Yes" : "No");

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

    // Format response
    const response = {
      success: true,
      data: {
        ...propertyUnit,
        fullAddress: propertyUnit.unitNumber 
          ? `${propertyUnit.unitNumber}, ${propertyUnit.address || ''}, ${propertyUnit.city || ''}`.replace(/\s*,\s*,/g, ',').replace(/,\s*$/, '')
          : `${propertyUnit.address || ''}, ${propertyUnit.city || ''}`.replace(/\s*,\s*,/g, ',').replace(/,\s*$/, '')
      }
    };

    console.log("Sending response for:", response.data.title);
    res.status(200).json(response);
    
  } catch (error) {
    console.error("Get property unit by ID error:", error);
    console.error("Error stack:", error.stack);
    
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

// Update property unit (Public)
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

    // Initialize update data
    let updateData = {};
    
    // Extract all fields from form data
    const fields = [
      // Basic Information
      'title', 'description', 'unitNumber',
      
      // Location
      'city', 'address', 'area',
      
      // Price
      'maintenanceCharges', 'securityDeposit',
      
      // Unit Category
      'propertyType', 'listingType',
      
      // Status
      'availability', 'isFeatured', 'isVerified', 'approvalStatus', 'rejectionReason',
      
      // Additional
      'mapUrl', 'virtualTour', 'metaTitle', 'metaDescription', 'displayOrder',
      
      // Owner Details
      'ownerName', 'ownerPhoneNumber', 'ownerEmail', 'ownerReasonForSelling',
      
      // Legal
      'reraRegistered', 'reraNumber', 'khataCertificate', 'encumbranceCertificate',
      'occupancyCertificate', 'ownershipType',
      
      // Contact
      'contactPreference',
      
      // Website
      'websiteAssignment'
    ];

    // Process text fields
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Parse JSON fields
    const parseJSONField = (fieldName) => {
      if (req.body[fieldName]) {
        try {
          return JSON.parse(req.body[fieldName]);
        } catch (e) {
          console.error(`Error parsing ${fieldName}:`, e);
          return req.body[fieldName];
        }
      }
      return undefined;
    };

    // Handle nested objects
    const priceData = parseJSONField('price');
    if (priceData) {
      updateData.price = priceData;
    }

    const specificationsData = parseJSONField('specifications');
    if (specificationsData) {
      updateData.specifications = specificationsData;
    }

    const buildingDetailsData = parseJSONField('buildingDetails');
    if (buildingDetailsData) {
      updateData.buildingDetails = buildingDetailsData;
    }

    const unitFeaturesData = parseJSONField('unitFeatures');
    if (unitFeaturesData) {
      updateData.unitFeatures = unitFeaturesData;
    }

    const rentalDetailsData = parseJSONField('rentalDetails');
    if (rentalDetailsData) {
      updateData.rentalDetails = rentalDetailsData;
    }

    const coordinatesData = parseJSONField('coordinates');
    if (coordinatesData) {
      updateData.coordinates = coordinatesData;
    }

    const legalDetailsData = parseJSONField('legalDetails');
    if (legalDetailsData) {
      updateData.legalDetails = legalDetailsData;
    }

    const viewingScheduleData = parseJSONField('viewingSchedule');
    if (viewingScheduleData) {
      updateData.viewingSchedule = viewingScheduleData;
    }

    const floorPlanData = parseJSONField('floorPlan');
    if (floorPlanData) {
      updateData.floorPlan = floorPlanData;
    }

    // Handle owner details as object if separate fields provided
    if (req.body.ownerName || req.body.ownerPhoneNumber || req.body.ownerEmail) {
      updateData.ownerDetails = {
        name: req.body.ownerName || propertyUnit.ownerDetails?.name,
        phoneNumber: req.body.ownerPhoneNumber || propertyUnit.ownerDetails?.phoneNumber,
        email: req.body.ownerEmail || propertyUnit.ownerDetails?.email,
        reasonForSelling: req.body.ownerReasonForSelling || propertyUnit.ownerDetails?.reasonForSelling
      };
    }

    // Handle legal details as object if separate fields provided
    if (req.body.reraRegistered !== undefined || req.body.reraNumber) {
      updateData.legalDetails = {
        ...propertyUnit.legalDetails,
        reraRegistered: req.body.reraRegistered !== undefined ? req.body.reraRegistered : propertyUnit.legalDetails?.reraRegistered,
        reraNumber: req.body.reraNumber || propertyUnit.legalDetails?.reraNumber,
        khataCertificate: req.body.khataCertificate !== undefined ? req.body.khataCertificate : propertyUnit.legalDetails?.khataCertificate,
        encumbranceCertificate: req.body.encumbranceCertificate !== undefined ? req.body.encumbranceCertificate : propertyUnit.legalDetails?.encumbranceCertificate,
        occupancyCertificate: req.body.occupancyCertificate !== undefined ? req.body.occupancyCertificate : propertyUnit.legalDetails?.occupancyCertificate,
        ownershipType: req.body.ownershipType || propertyUnit.legalDetails?.ownershipType
      };
    }

    // Handle website assignment
    if (req.body.websiteAssignment) {
      if (typeof req.body.websiteAssignment === 'string') {
        updateData.websiteAssignment = req.body.websiteAssignment.split(',');
      } else if (Array.isArray(req.body.websiteAssignment)) {
        updateData.websiteAssignment = req.body.websiteAssignment;
      }
    }

    // Handle contact preference
    if (req.body.contactPreference) {
      if (typeof req.body.contactPreference === 'string') {
        updateData.contactPreference = req.body.contactPreference.split(',');
      } else if (Array.isArray(req.body.contactPreference)) {
        updateData.contactPreference = req.body.contactPreference;
      }
    }

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

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const newImages = [];
      
      // Separate regular images from floor plan
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "property-units",
          });
          
          // Check if this is a floor plan
          if (file.fieldname === 'floorPlanImage') {
            updateData.floorPlan = {
              image: result.secure_url,
              public_id: result.public_id,
              description: req.body.floorPlanDescription || ""
            };
          } else {
            newImages.push({
              url: result.secure_url,
              public_id: result.public_id,
              caption: ""
            });
          }
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
        }
      }
      
      // Handle existing images
      const existingImages = req.body.existingImages;
      if (existingImages) {
        let existingImagesArray;
        try {
          existingImagesArray = JSON.parse(existingImages);
        } catch (e) {
          existingImagesArray = existingImages.split(',');
        }
        
        // Filter out deleted images
        const filteredImages = propertyUnit.images.filter(img => 
          existingImagesArray.includes(img.url)
        );
        
        // Add new images
        updateData.images = [...filteredImages, ...newImages];
      } else {
        // Keep all existing images and add new ones
        updateData.images = [...propertyUnit.images, ...newImages];
      }
    }

    // Handle floor plan upload separately if no new floor plan image
    if (req.body.floorPlanDescription && !updateData.floorPlan) {
      updateData.floorPlan = {
        ...propertyUnit.floorPlan,
        description: req.body.floorPlanDescription
      };
    }

    // Update the property unit
    const updatedPropertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('createdBy', 'name email phoneNumber')
    .populate('parentProperty', 'title');

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

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value entered'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating property unit',
      error: error.message
    });
  }
};

// Delete property unit (Public)
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


// Add to your exports

};


module.exports = {
  createPropertyUnit,
  getPropertyUnits,
  getPropertyUnitById,
  updatePropertyUnit,
  deletePropertyUnit,  
getFeaturedPropertyUnits
};