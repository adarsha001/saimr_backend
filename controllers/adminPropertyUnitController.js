const PropertyUnit = require("../models/PropertyUnit");
const User = require("../models/user");
const cloudinary = require("../config/cloudinary");
const mongoose = require("mongoose");

// Get all property units (Admin)
const getAllPropertyUnits = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      approvalStatus = "",
      propertyType = "",
      listingType = "",
      city = "",
      bedrooms = "",
      availability = "",
      isFeatured = "",
      isVerified = "",
      createdBy = "",
      sortBy = "createdAt",
      sortOrder = "desc"
    } = req.query;

    // Build query
    const query = {};

    // Search in multiple fields
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { unitNumber: { $regex: search, $options: "i" } },
        { "ownerDetails.name": { $regex: search, $options: "i" } },
        { "ownerDetails.phoneNumber": { $regex: search, $options: "i" } }
      ];
    }

    // Filters
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (propertyType) query.propertyType = propertyType;
    if (listingType) query.listingType = listingType;
    if (city) query.city = city;
    if (availability) query.availability = availability;
    if (bedrooms) query["specifications.bedrooms"] = parseInt(bedrooms);
    if (isFeatured !== "") query.isFeatured = isFeatured === "true";
    if (isVerified !== "") query.isVerified = isVerified === "true";
    if (createdBy) query.createdBy = createdBy;

    // Sort - remove price sorting options
    const sort = {};
    if (sortBy === 'price.amount') {
      // Handle string price sorting by converting to number temporarily
      // This is a workaround for string prices
      sort['price.amount'] = sortOrder === "desc" ? -1 : 1;
    } else {
      sort[sortBy] = sortOrder === "desc" ? -1 : 1;
    }

    // Execute query
    const propertyUnits = await PropertyUnit.find(query)
      .populate("createdBy", "name email phoneNumber userType")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Convert price.amount to number for proper sorting if needed
    if (sortBy === 'price.amount') {
      propertyUnits.sort((a, b) => {
        const amountA = parseFloat(a.price?.amount || 0);
        const amountB = parseFloat(b.price?.amount || 0);
        return sortOrder === "desc" ? amountB - amountA : amountA - amountB;
      });
    }

    const total = await PropertyUnit.countDocuments(query);

    // Get stats for admin dashboard
    const stats = {
      total: await PropertyUnit.countDocuments(),
      pending: await PropertyUnit.countDocuments({ approvalStatus: "pending" }),
      approved: await PropertyUnit.countDocuments({ approvalStatus: "approved" }),
      rejected: await PropertyUnit.countDocuments({ approvalStatus: "rejected" }),
      featured: await PropertyUnit.countDocuments({ isFeatured: true }),
      verified: await PropertyUnit.countDocuments({ isVerified: true }),
      forSale: await PropertyUnit.countDocuments({ listingType: "sale" }),
      forRent: await PropertyUnit.countDocuments({ listingType: "rent" })
    };

    // Ensure price.amount is string in response
    propertyUnits.forEach(unit => {
      if (unit.price && typeof unit.price.amount !== 'string') {
        unit.price.amount = unit.price.amount.toString();
      }
    });

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      stats,
      data: propertyUnits
    });
  } catch (error) {
    console.error("Get all property units error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching property units",
      error: error.message
    });
  }
};

// Get single property unit by ID (Admin)
const getPropertyUnitByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID format"
      });
    }

    const propertyUnit = await PropertyUnit.findById(id)
      .populate("createdBy", "name email phoneNumber userType createdAt")
      .populate("parentProperty", "title description")
      .lean();

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    // Ensure price.amount is string
    if (propertyUnit.price && typeof propertyUnit.price.amount !== 'string') {
      propertyUnit.price.amount = propertyUnit.price.amount.toString();
    }

    res.status(200).json({
      success: true,
      data: propertyUnit
    });
  } catch (error) {
    console.error("Get property unit by ID error:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Error fetching property unit",
      error: error.message
    });
  }
};

// Create property unit (Admin)
const createPropertyUnitAdmin = async (req, res) => {
  try {
    console.log('Admin creating property unit:', req.user);

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
      approvalStatus = "approved",
      isFeatured = true,
      isVerified = true,
      availability = "available",
      listingType = "sale",
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
      createdBy,
      area
    } = req.body;

    // Check required fields
    if (!title || !city || !address || !price || !propertyType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: title, city, address, price, propertyType"
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
        message: `Invalid property type. Must be one of: ${validPropertyTypes.join(", ")}`
      });
    }

    // Upload images to Cloudinary
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "property-units"
          });
          uploadedImages.push({
            url: result.secure_url,
            public_id: result.public_id,
            caption: ""
          });
        } catch (uploadError) {
          console.error("Cloudinary upload error:", uploadError);
          return res.status(500).json({
            success: false,
            message: "Error uploading images to Cloudinary"
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "At least one image is required"
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
    let parsedPrice = {};

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
      
      // Parse price - ensure amount is string
      parsedPrice = price ? JSON.parse(price) : {};
      if (parsedPrice.amount !== undefined && typeof parsedPrice.amount !== 'string') {
        parsedPrice.amount = parsedPrice.amount.toString();
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return res.status(400).json({
        success: false,
        message: "Invalid JSON format in one of the fields"
      });
    }

    // Handle price amount from separate field
    if (req.body.priceAmount && !parsedPrice.amount) {
      parsedPrice.amount = req.body.priceAmount.toString();
    }
    if (req.body.priceCurrency && !parsedPrice.currency) {
      parsedPrice.currency = req.body.priceCurrency;
    }
    if (req.body.pricePerUnit && !parsedPrice.perUnit) {
      parsedPrice.perUnit = req.body.pricePerUnit;
    }

    // Set default price values
    if (!parsedPrice.amount) parsedPrice.amount = "0";
    if (!parsedPrice.currency) parsedPrice.currency = "INR";
    if (!parsedPrice.perUnit) parsedPrice.perUnit = "total";

    // Validate specifications based on property type
    const requiredSpecs = {
      Apartment: ["bedrooms", "bathrooms", "carpetArea", "builtUpArea"],
      Villa: ["bedrooms", "bathrooms", "carpetArea", "plotArea"],
      Plot: ["plotArea"],
      "Commercial Space": ["carpetArea", "builtUpArea"]
    };

    const propertyTypeRequirements = requiredSpecs[propertyType] || ["bedrooms", "bathrooms", "carpetArea"];
    for (const spec of propertyTypeRequirements) {
      if (!parsedSpecifications[spec] && parsedSpecifications[spec] !== 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required specification: ${spec} for ${propertyType} property type`
        });
      }
    }

    // Validate listing type
    const validListingTypes = ["sale", "rent", "lease", "pg"];
    const finalListingType = listingType && validListingTypes.includes(listingType) ? listingType : "sale";

    // Determine creator - admin can create for themselves or for other users
    const creatorId = createdBy || req.user._id;

    // Create new property unit
    const newPropertyUnit = new PropertyUnit({
      // Basic Information
      title,
      description,
      unitNumber,

      // Location
      city,
      address,
      area: area || "",
      coordinates: parsedCoordinates,
      mapUrl: mapUrl ? mapUrl.trim() : undefined,

      // Price - amount as string
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
        availableForRent: parsedRentalDetails.availableForRent || (finalListingType === "rent" || finalListingType === "lease"),
        leaseDuration: parsedRentalDetails.leaseDuration || { value: 11, unit: "months" },
        rentNegotiable: parsedRentalDetails.rentNegotiable !== undefined ? parsedRentalDetails.rentNegotiable : true,
        preferredTenants: parsedRentalDetails.preferredTenants || ["any"],
        includedInRent: parsedRentalDetails.includedInRent || []
      },

      // Status & Approval (Admin has full control)
      approvalStatus,
      isFeatured,
      isVerified,
      availability,
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
      contactPreference: contactPreference ? (typeof contactPreference === 'string' ? contactPreference.split(',') : contactPreference) : ["call", "whatsapp"],
      metaTitle,
      metaDescription,
      displayOrder: displayOrder || 0,

      // Parent Property
      parentProperty,

      // Rejection
      rejectionReason: rejectionReason || "",

      // Creator - admin can specify or use their own ID
      createdBy: creatorId,

      // Mark as created by admin
      createdByAdmin: true,
      adminNotes: req.body.adminNotes || ""
    });

    // Save the property unit
    await newPropertyUnit.save();

    // Update user's postedProperties array if created for a user
    if (creatorId !== req.user._id) {
      try {
        const foundUser = await User.findById(creatorId);
        if (foundUser) {
          foundUser.postedProperties.push({
            property: newPropertyUnit._id,
            postedAt: newPropertyUnit.createdAt,
            status: "active",
            type: "propertyUnit",
            addedByAdmin: true,
            adminId: req.user._id
          });
          await foundUser.save();
          console.log(`Property unit ${newPropertyUnit._id} added to user ${creatorId}'s postedProperties by admin`);
        }
      } catch (userUpdateError) {
        console.error("Error updating user postedProperties:", userUpdateError);
      }
    }

    // Populate with correct field names
    await newPropertyUnit.populate("createdBy", "name username email phoneNumber");

    // Ensure price.amount is string in response
    if (newPropertyUnit.price && typeof newPropertyUnit.price.amount !== 'string') {
      newPropertyUnit.price.amount = newPropertyUnit.price.amount.toString();
    }

    res.status(201).json({
      success: true,
      message: "Property unit created successfully by admin",
      data: newPropertyUnit
    });
  } catch (error) {
    console.error("Admin create property unit error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }

    // Handle duplicate slug error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      return res.status(400).json({
        success: false,
        message: "A property with similar title already exists"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating property unit",
      error: error.message
    });
  }
};

// Update property unit (Admin)
const updatePropertyUnitAdmin = async (req, res) => {
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
      
      // Price - ensure amount is string
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
          const parsed = JSON.parse(req.body[fieldName]);
          // Special handling for price to ensure amount is string
          if (fieldName === 'price' && parsed.amount !== undefined) {
            parsed.amount = parsed.amount.toString();
          }
          return parsed;
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
      // Ensure price.amount is string
      if (priceData.amount !== undefined && typeof priceData.amount !== 'string') {
        priceData.amount = priceData.amount.toString();
      }
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

    // Handle price as separate fields if provided
    if (req.body.priceAmount) {
      updateData.price = {
        ...propertyUnit.price,
        amount: req.body.priceAmount.toString(), // Ensure it's string
        currency: req.body.priceCurrency || propertyUnit.price?.currency || 'INR',
        perUnit: req.body.pricePerUnit || propertyUnit.price?.perUnit || 'total'
      };
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

    // Ensure price.amount is string in response
    if (updatedPropertyUnit.price && typeof updatedPropertyUnit.price.amount !== 'string') {
      updatedPropertyUnit.price.amount = updatedPropertyUnit.price.amount.toString();
    }

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

// Delete property unit (Admin)
const deletePropertyUnitAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID format"
      });
    }

    // Find property unit
    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    // Delete images from Cloudinary
    if (propertyUnit.images && propertyUnit.images.length > 0) {
      for (const image of propertyUnit.images) {
        if (image.public_id) {
          try {
            await cloudinary.uploader.destroy(image.public_id);
          } catch (cloudinaryError) {
            console.error("Error deleting image from Cloudinary:", cloudinaryError);
          }
        }
      }
    }

    // Delete floor plan from Cloudinary if exists
    if (propertyUnit.floorPlan && propertyUnit.floorPlan.public_id) {
      try {
        await cloudinary.uploader.destroy(propertyUnit.floorPlan.public_id);
      } catch (error) {
        console.error("Error deleting floor plan from Cloudinary:", error);
      }
    }

    // Remove from user's postedProperties
    await User.findByIdAndUpdate(propertyUnit.createdBy, {
      $pull: { postedProperties: { property: id } }
    });

    // Delete from database
    await PropertyUnit.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Property unit deleted successfully"
    });
  } catch (error) {
    console.error("Delete property unit error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting property unit",
      error: error.message
    });
  }
};

// Update approval status
const updateApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, rejectionReason } = req.body;

    if (!approvalStatus || !["pending", "approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Valid approval status is required"
      });
    }

    if (approvalStatus === "rejected" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required when rejecting a property unit"
      });
    }

    const updateData = {
      approvalStatus,
      rejectionReason: approvalStatus === "rejected" ? rejectionReason : "",
      adminUpdates: {
        adminId: req.user._id,
        adminName: req.user.name,
        action: "approval-update",
        timestamp: new Date()
      }
    };

    const updatedPropertyUnit = await PropertyUnit.findByIdAndUpdate(id, updateData, {
      new: true
    }).populate("createdBy", "name email");

    // Ensure price.amount is string in response
    if (updatedPropertyUnit.price && typeof updatedPropertyUnit.price.amount !== 'string') {
      updatedPropertyUnit.price.amount = updatedPropertyUnit.price.amount.toString();
    }

    res.status(200).json({
      success: true,
      message: `Property unit ${approvalStatus} successfully`,
      data: updatedPropertyUnit
    });
  } catch (error) {
    console.error("Update approval status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating approval status",
      error: error.message
    });
  }
};

// Toggle featured status
const toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;

    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    const newFeaturedStatus = !propertyUnit.isFeatured;

    const updateData = {
      isFeatured: newFeaturedStatus,
      adminUpdates: {
        adminId: req.user._id,
        adminName: req.user.name,
        action: "toggle-featured",
        timestamp: new Date()
      }
    };

    const updatedPropertyUnit = await PropertyUnit.findByIdAndUpdate(id, updateData, {
      new: true
    });

    // Ensure price.amount is string in response
    if (updatedPropertyUnit.price && typeof updatedPropertyUnit.price.amount !== 'string') {
      updatedPropertyUnit.price.amount = updatedPropertyUnit.price.amount.toString();
    }

    res.status(200).json({
      success: true,
      message: `Property unit ${newFeaturedStatus ? "featured" : "unfeatured"} successfully`,
      data: updatedPropertyUnit
    });
  } catch (error) {
    console.error("Toggle featured error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling featured status",
      error: error.message
    });
  }
};

// Toggle verified status
const toggleVerified = async (req, res) => {
  try {
    const { id } = req.params;

    const propertyUnit = await PropertyUnit.findById(id);
    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    const newVerifiedStatus = !propertyUnit.isVerified;

    const updateData = {
      isVerified: newVerifiedStatus,
      adminUpdates: {
        adminId: req.user._id,
        adminName: req.user.name,
        action: "toggle-verified",
        timestamp: new Date()
      }
    };

    const updatedPropertyUnit = await PropertyUnit.findByIdAndUpdate(id, updateData, {
      new: true
    });

    // Ensure price.amount is string in response
    if (updatedPropertyUnit.price && typeof updatedPropertyUnit.price.amount !== 'string') {
      updatedPropertyUnit.price.amount = updatedPropertyUnit.price.amount.toString();
    }

    res.status(200).json({
      success: true,
      message: `Property unit ${newVerifiedStatus ? "verified" : "unverified"} successfully`,
      data: updatedPropertyUnit
    });
  } catch (error) {
    console.error("Toggle verified error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling verified status",
      error: error.message
    });
  }
};

// Get property unit statistics
const getPropertyUnitStats = async (req, res) => {
  try {
    // Get total counts
    const total = await PropertyUnit.countDocuments();
    const pending = await PropertyUnit.countDocuments({ approvalStatus: "pending" });
    const approved = await PropertyUnit.countDocuments({ approvalStatus: "approved" });
    const rejected = await PropertyUnit.countDocuments({ approvalStatus: "rejected" });
    const featured = await PropertyUnit.countDocuments({ isFeatured: true });
    const verified = await PropertyUnit.countDocuments({ isVerified: true });

    // Get counts by listing type
    const saleCount = await PropertyUnit.countDocuments({ listingType: "sale" });
    const rentCount = await PropertyUnit.countDocuments({ listingType: "rent" });
    const leaseCount = await PropertyUnit.countDocuments({ listingType: "lease" });
    const pgCount = await PropertyUnit.countDocuments({ listingType: "pg" });

    // Get top cities
    const topCities = await PropertyUnit.aggregate([
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get recent property units (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = await PropertyUnit.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Get counts by property type
    const propertyTypeStats = await PropertyUnit.aggregate([
      { $group: { _id: "$propertyType", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        featured,
        verified,
        byListingType: {
          sale: saleCount,
          rent: rentCount,
          lease: leaseCount,
          pg: pgCount
        },
        byPropertyType: propertyTypeStats,
        topCities,
        recent: recentCount
      }
    });
  } 
// Get property unit statistic
 catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message
    });
  }
};

// Bulk update property units
const bulkUpdatePropertyUnits = async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide property unit IDs"
      });
    }

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({
        success: false,
        message: "Please provide updates"
      });
    }

    // Filter out invalid updates
    const allowedUpdates = ["approvalStatus", "isFeatured", "isVerified", "availability"];
    const filteredUpdates = {};

    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid updates provided"
      });
    }

    // Update multiple property units
    const result = await PropertyUnit.updateMany(
      { _id: { $in: ids } },
      { $set: filteredUpdates }
    );

    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} property unit(s)`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      success: false,
      message: "Error performing bulk update",
      error: error.message
    });
  }
};

// Bulk delete property units
const bulkDeletePropertyUnits = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide property unit IDs to delete"
      });
    }

    // Find all property units to delete
    const propertyUnits = await PropertyUnit.find({ _id: { $in: ids } });

    // Delete images from Cloudinary for each property unit
    for (const propertyUnit of propertyUnits) {
      if (propertyUnit.images && propertyUnit.images.length > 0) {
        for (const image of propertyUnit.images) {
          if (image.public_id) {
            try {
              await cloudinary.uploader.destroy(image.public_id);
            } catch (cloudinaryError) {
              console.error("Error deleting image from Cloudinary:", cloudinaryError);
            }
          }
        }
      }

      // Delete floor plan
      if (propertyUnit.floorPlan && propertyUnit.floorPlan.public_id) {
        try {
          await cloudinary.uploader.destroy(propertyUnit.floorPlan.public_id);
        } catch (error) {
          console.error("Error deleting floor plan:", error);
        }
      }

      // Remove from user's postedProperties
      await User.findByIdAndUpdate(propertyUnit.createdBy, {
        $pull: { postedProperties: { property: propertyUnit._id } }
      });
    }

    // Delete from database
    const result = await PropertyUnit.deleteMany({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} property unit(s)`,
      data: {
        deletedCount: result.deletedCount
      }
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({
      success: false,
      message: "Error performing bulk delete",
      error: error.message
    });
  }
};


// Update display order for multiple properties (for drag & drop)
const updateDisplayOrders = async (req, res) => {
  try {
    const { orders } = req.body; // Array of { id, displayOrder }

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide display orders"
      });
    }

    // Validate input
    const validOrders = orders.filter(order => 
      order.id && mongoose.Types.ObjectId.isValid(order.id) && 
      typeof order.displayOrder === 'number' && order.displayOrder >= 0
    );

    if (validOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order data provided"
      });
    }

    // Update display orders in bulk
    const bulkOperations = validOrders.map(order => ({
      updateOne: {
        filter: { _id: order.id },
        update: { 
          $set: { 
            displayOrder: order.displayOrder,
            updatedAt: new Date()
          }
        }
      }
    }));

    // Execute bulk write
    const result = await PropertyUnit.bulkWrite(bulkOperations);

    // Get updated properties
    const updatedIds = validOrders.map(order => order.id);
    const updatedProperties = await PropertyUnit.find({
      _id: { $in: updatedIds }
    }).select('title displayOrder');

    res.status(200).json({
      success: true,
      message: `Display orders updated for ${result.modifiedCount} properties`,
      data: {
        modifiedCount: result.modifiedCount,
        updatedProperties
      }
    });
  } catch (error) {
    console.error("Update display orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating display orders",
      error: error.message
    });
  }
};

// Update display order for single property
const updateSingleDisplayOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder } = req.body;

    if (displayOrder === undefined || displayOrder === null) {
      return res.status(400).json({
        success: false,
        message: "Display order is required"
      });
    }

    if (displayOrder < 0) {
      return res.status(400).json({
        success: false,
        message: "Display order must be a positive number"
      });
    }

    const propertyUnit = await PropertyUnit.findByIdAndUpdate(
      id,
      { displayOrder, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('title displayOrder createdAt updatedAt');

    if (!propertyUnit) {
      return res.status(404).json({
        success: false,
        message: "Property unit not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Display order updated successfully",
      data: propertyUnit
    });
  } catch (error) {
    console.error("Update single display order error:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid property unit ID"
      });
    }

    res.status(500).json({
      success: false,
      message: "Error updating display order",
      error: error.message
    });
  }
};

// Add to module.exports
module.exports = {
  // ... existing exports ...
  updateDisplayOrders,
  updateSingleDisplayOrder
};
module.exports = {
  getAllPropertyUnits,
  getPropertyUnitByIdAdmin,
  createPropertyUnitAdmin,
  updatePropertyUnitAdmin,
  deletePropertyUnitAdmin,
  updateApprovalStatus,
  toggleFeatured,
  toggleVerified,
  getPropertyUnitStats,
  bulkUpdatePropertyUnits,
  bulkDeletePropertyUnits, updateDisplayOrders,
  updateSingleDisplayOrder
};