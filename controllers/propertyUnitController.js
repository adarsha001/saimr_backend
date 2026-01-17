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
    const isAdminUser = req.user.isAdmin === true; // Fixed: Check boolean isAdmin field
    
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

    // Upload images to Cloudinary with watermark - FIXED VERSION
    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          // Check if file has valid data
          if (!file || (!file.path && !file.buffer)) {
            console.error('Invalid file:', file);
            continue;
          }
          
          // Upload to Cloudinary WITHOUT complex transformations first
          let uploadResult;
          
          if (file.buffer) {
            // For memory storage
            uploadResult = await cloudinary.uploader.upload(
              `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
              {
                folder: "property-units",
                transformation: [
                  { width: 1200, height: 800, crop: "limit" },
                  { quality: "auto:good" }
                ]
              }
            );
          } else {
            // For disk storage
            uploadResult = await cloudinary.uploader.upload(file.path, {
              folder: "property-units",
              transformation: [
                { width: 1200, height: 800, crop: "limit" },
                { quality: "auto:good" }
              ]
            });
          }
          
          // Apply watermark as a separate transformation
          const watermarkedUrl = cloudinary.url(uploadResult.public_id, {
            transformation: [
              // Base image
              { width: 1200, height: 800, crop: "limit" },
              // Watermark overlay (simplified version)
              {
                overlay: {
                  font_family: "Arial",
                  font_size: 40,
                  font_weight: "bold",
                  text: encodeURIComponent("CLEARTITLE1")
                },
                color: "#FFFFFF",
                opacity: 60,
                background: "rgba(0,0,0,0.5)",
                gravity: "south",
                y: 20
              }
            ]
          });
          
          uploadedImages.push({
            url: watermarkedUrl,
            public_id: uploadResult.public_id,
            caption: "",
            originalUrl: uploadResult.secure_url,
            watermarkedUrl: watermarkedUrl,
            watermarked: true
          });
          
          console.log(`Image uploaded successfully: ${uploadResult.secure_url}`);
          
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          
          // Try without any transformations
          try {
            const simpleResult = await cloudinary.uploader.upload(
              file.path || file.buffer,
              { folder: "property-units" }
            );
            
            uploadedImages.push({
              url: simpleResult.secure_url,
              public_id: simpleResult.public_id,
              caption: "",
              originalUrl: simpleResult.secure_url,
              watermarkedUrl: simpleResult.secure_url,
              watermarked: false
            });
            
            console.log(`Image uploaded without transformations: ${simpleResult.secure_url}`);
          } catch (simpleError) {
            console.error('Even simple upload failed:', simpleError);
            return res.status(500).json({
              success: false,
              message: 'Error uploading images to Cloudinary'
            });
          }
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
      rejectionReason: isAdminUser && finalApprovalStatus === 'rejected' ? rejectionReason : "",
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
      // Don't fail the whole request if this fails
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

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate field value entered'
      });
    }

    res.status(500).json({ 
      success: false, 
      message: "Error adding property unit",
      error: error.message 
    });
  }
};

const createPropertyUnitN8n = async (req, res) => {
  try {
    console.log('=== N8N PROPERTY UNIT CREATION ===');
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    // === SECURITY: Validate request source ===
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization token required"
      });
    }

    // === VALIDATE REQUIRED FIELDS ===
    const requiredFields = [
      'title',
      'city', 
      'address',
      'propertyType',
      'price',
      'createdBy'  // User ID from n8n
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        required: requiredFields
      });
    }

    // === VALIDATE PROPERTY TYPE ===
    const validPropertyTypes = [
      "Apartment", "Villa", "Independent House", "Studio", 
      "Penthouse", "Duplex", "Pg house", "Plot", "Commercial Space"
    ];

    if (!validPropertyTypes.includes(req.body.propertyType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid propertyType. Must be one of: ${validPropertyTypes.join(', ')}`,
        received: req.body.propertyType
      });
    }

    // === VALIDATE USER ===
    const user = await User.findById(req.body.createdBy);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: `User with ID ${req.body.createdBy} not found`
      });
    }

    // === VALIDATE SPECIFICATIONS ===
    let specifications = {};
    if (req.body.specifications) {
      try {
        specifications = typeof req.body.specifications === 'string' 
          ? JSON.parse(req.body.specifications)
          : req.body.specifications;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid specifications format. Must be valid JSON object",
          error: error.message
        });
      }
    }

    // Set default specifications if not provided
    const defaultSpecs = {
      bedrooms: 0,
      bathrooms: 0,
      balconies: 0,
      floors: 1,
      carpetArea: 0,
      builtUpArea: 0,
      furnishing: "unfurnished",
      possessionStatus: "ready-to-move",
      parking: { covered: 0, open: 0 },
      kitchenType: "regular"
    };

    // Merge provided specs with defaults
    specifications = { ...defaultSpecs, ...specifications };

    // === VALIDATE PRICE ===
    let price = {};
    if (req.body.price) {
      try {
        price = typeof req.body.price === 'string' 
          ? JSON.parse(req.body.price)
          : req.body.price;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid price format. Must be valid JSON object",
          error: error.message
        });
      }
    }

    if (!price.amount || isNaN(Number(price.amount))) {
      return res.status(400).json({
        success: false,
        message: "Price must have a valid 'amount' field",
        received: price
      });
    }

    // === PARSE OPTIONAL FIELDS ===
    const parseField = (field, defaultValue) => {
      if (!req.body[field]) return defaultValue;
      try {
        return typeof req.body[field] === 'string' 
          ? JSON.parse(req.body[field])
          : req.body[field];
      } catch (error) {
        console.warn(`Failed to parse ${field}, using default`);
        return defaultValue;
      }
    };

    const buildingDetails = parseField('buildingDetails', {});
    const unitFeatures = parseField('unitFeatures', []);
    const rentalDetails = parseField('rentalDetails', {});
    const coordinates = parseField('coordinates', { latitude: null, longitude: null });
    const ownerDetails = parseField('ownerDetails', {});
    const legalDetails = parseField('legalDetails', {});
    const floorPlan = parseField('floorPlan', {});
    const viewingSchedule = parseField('viewingSchedule', []);

    // === PROCESS IMAGES WITH WATERMARK ===
    let images = [];
    
    // Function to add watermark to Cloudinary URL
    const addWatermarkToUrl = (url) => {
      if (!url || !url.includes('cloudinary.com')) {
        return url; // Return original if not Cloudinary URL
      }
      
      // Split URL to insert watermark transformation
      const parts = url.split('/upload/');
      if (parts.length !== 2) return url;
      
      // Add watermark transformation
      const watermarkTransformations = [
        'l_text:Arial_40_bold:CLEARTITLE1,co_white,bo_2px_solid_rgb:00000040',
        'g_south',
        'y_20',
        'fl_relative',
        'w_0.8'
      ].join(',');
      
      return `${parts[0]}/upload/${watermarkTransformations}/${parts[1]}`;
    };
    
    // Function to upload image to Cloudinary with watermark
    const uploadImageWithWatermark = async (imageUrl) => {
      try {
        console.log(`Uploading image with watermark: ${imageUrl}`);
        
        // If it's already a Cloudinary URL with a watermark, return as is
        if (imageUrl.includes('cloudinary.com') && imageUrl.includes('l_text:Arial')) {
          console.log('Image already has watermark, using existing URL');
          const publicIdMatch = imageUrl.match(/upload\/(?:v\d+\/)?(.+?)(?:\.[^\.]+)?$/);
          const publicId = publicIdMatch ? publicIdMatch[1] : `property-unit-${Date.now()}`;
          
          return {
            url: imageUrl,
            public_id: publicId,
            caption: '',
            watermarked: true,
            originalUrl: imageUrl.replace(/l_text:.*?,/g, '')
          };
        }
        
        // Upload image to Cloudinary with watermark transformation
        const result = await cloudinary.uploader.upload(imageUrl, {
          folder: "property-units/n8n",
          transformation: [
            {
              overlay: {
                font_family: "Arial",
                font_size: 40,
                font_weight: "bold",
                text: "CLEARTITLE1",
                text_align: "center"
              },
              color: "#FFFFFF",
              background: "rgba(0, 0, 0, 0.4)",
              opacity: 80,
              width: "auto",
              crop: "fit",
              gravity: "south",
              y: 20
            },
            // Optional: Add another watermark at top right
            {
              overlay: {
                font_family: "Arial",
                font_size: 30,
                font_weight: "bold",
                text: "CLEARTITLE",
                text_align: "right"
              },
              color: "#FFFFFF",
              background: "rgba(0, 0, 0, 0.3)",
              opacity: 70,
              width: "auto",
              crop: "fit",
              gravity: "north_east",
              x: 20,
              y: 20
            }
          ]
        });
        
        console.log(`✓ Image uploaded with watermark: ${result.secure_url}`);
        
        return {
          url: result.secure_url,
          public_id: result.public_id,
          caption: '',
          watermarked: true,
          originalUrl: imageUrl
        };
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        
        // Fallback: Just add watermark to URL if it's already in Cloudinary
        if (imageUrl.includes('cloudinary.com')) {
          const watermarkedUrl = addWatermarkToUrl(imageUrl);
          return {
            url: watermarkedUrl,
            public_id: imageUrl.split('/').pop().split('.')[0],
            caption: '',
            watermarked: true,
            originalUrl: imageUrl
          };
        }
        
        // If upload fails, use original URL with warning
        return {
          url: imageUrl,
          public_id: `fallback-${Date.now()}`,
          caption: '',
          watermarked: false,
          originalUrl: imageUrl,
          warning: 'Watermark not applied'
        };
      }
    };
    
    // Process images array
    if (req.body.images && Array.isArray(req.body.images)) {
      console.log(`Processing ${req.body.images.length} images...`);
      
      // Method 1: If images are already uploaded objects
      for (let img of req.body.images) {
        if (img.url && img.url.trim() !== '') {
          try {
            // Upload/process image with watermark
            const processedImage = await uploadImageWithWatermark(img.url);
            
            images.push({
              url: processedImage.url,
              public_id: processedImage.public_id,
              caption: img.caption || '',
              watermarked: processedImage.watermarked,
              originalUrl: processedImage.originalUrl || img.url
            });
          } catch (error) {
            console.error(`Failed to process image ${img.url}:`, error.message);
            // Add image without watermark as fallback
            images.push({
              url: img.url,
              public_id: img.public_id || `fallback-${Date.now()}`,
              caption: img.caption || '',
              watermarked: false,
              warning: 'Watermark processing failed'
            });
          }
        }
      }
    }
    
    // IMPORTANT: Allow empty images array for n8n
    // Images can be added later or might come from another source

    // === DETERMINE LISTING TYPE ===
    let listingType = "sale";
    if (req.body.listingType && ["sale", "rent", "lease", "pg"].includes(req.body.listingType)) {
      listingType = req.body.listingType;
    } else if (rentalDetails.availableForRent) {
      listingType = "rent";
    }

    // === VALIDATE UNIT FEATURES (ENUM) ===
    const validUnitFeatures = [
      "Air Conditioning", "Modular Kitchen", "Wardrobes", "Geyser", "Exhaust Fan", 
      "Chimney", "Lighting", "Ceiling Fans", "Smart Home Automation", "Central AC", 
      "bore water", "Walk-in Closet", "Study Room", "Pooja Room", "Utility Area", 
      "Servant Room", "Private Garden", "Terrace", "Balcony", "Swimming Pool", 
      "Video Door Phone", "Security Alarm", "Fire Safety", "CCTV", "Pet Friendly", 
      "Wheelchair Access", "Natural Light", "View"
    ];

    const filteredUnitFeatures = unitFeatures.filter(feature => 
      validUnitFeatures.includes(feature)
    );

    // === CREATE PROPERTY UNIT OBJECT ===
    const propertyUnitData = {
      title: req.body.title.trim(),
      description: req.body.description || '',
      unitNumber: req.body.unitNumber || '',
      images: images, // Can be empty array
      city: req.body.city.trim(),
      address: req.body.address.trim(),
      coordinates: coordinates,
      mapUrl: req.body.mapUrl || '',
      price: {
        amount: String(price.amount),
        currency: price.currency || "INR",
        perUnit: price.perUnit || "total"
      },
      maintenanceCharges: Number(req.body.maintenanceCharges) || 0,
      securityDeposit: Number(req.body.securityDeposit) || 0,
      propertyType: req.body.propertyType,
      specifications: {
        bedrooms: Number(specifications.bedrooms) || 0,
        bathrooms: Number(specifications.bathrooms) || 0,
        balconies: Number(specifications.balconies) || 0,
        floors: Number(specifications.floors) || 1,
        floorNumber: specifications.floorNumber ? Number(specifications.floorNumber) : null,
        carpetArea: Number(specifications.carpetArea) || 0,
        builtUpArea: Number(specifications.builtUpArea) || 0,
        superBuiltUpArea: specifications.superBuiltUpArea ? Number(specifications.superBuiltUpArea) : null,
        plotArea: specifications.plotArea ? Number(specifications.plotArea) : null,
        furnishing: specifications.furnishing || "unfurnished",
        possessionStatus: specifications.possessionStatus || "ready-to-move",
        ageOfProperty: specifications.ageOfProperty ? Number(specifications.ageOfProperty) : null,
        parking: {
          covered: specifications.parking?.covered ? Number(specifications.parking.covered) : 0,
          open: specifications.parking?.open ? Number(specifications.parking.open) : 0
        },
        kitchenType: specifications.kitchenType || "regular"
      },
      buildingDetails: {
        name: buildingDetails.name || '',
        totalFloors: buildingDetails.totalFloors ? Number(buildingDetails.totalFloors) : null,
        totalUnits: buildingDetails.totalUnits ? Number(buildingDetails.totalUnits) : null,
        yearBuilt: buildingDetails.yearBuilt ? Number(buildingDetails.yearBuilt) : null,
        amenities: Array.isArray(buildingDetails.amenities) ? buildingDetails.amenities : []
      },
      unitFeatures: filteredUnitFeatures,
      rentalDetails: {
        availableForRent: rentalDetails.availableForRent || false,
        leaseDuration: {
          value: rentalDetails.leaseDuration?.value || 11,
          unit: rentalDetails.leaseDuration?.unit || "months"
        },
        rentNegotiable: rentalDetails.rentNegotiable !== undefined ? rentalDetails.rentNegotiable : true,
        preferredTenants: rentalDetails.preferredTenants || [],
        includedInRent: rentalDetails.includedInRent || []
      },
      availability: req.body.availability || "available",
      isFeatured: req.body.isFeatured === true || req.body.isFeatured === 'true',
      isVerified: req.body.isVerified === true || req.body.isVerified === 'true',
      approvalStatus: req.body.approvalStatus || "pending",
      listingType: listingType,
      websiteAssignment: req.body.websiteAssignment && Array.isArray(req.body.websiteAssignment)
        ? [...new Set([...req.body.websiteAssignment, "cleartitle"])]
        : ["cleartitle"],
      rejectionReason: req.body.rejectionReason || '',
      virtualTour: req.body.virtualTour || '',
      floorPlan: {
        image: floorPlan.image || '',
        public_id: floorPlan.public_id || '',
        description: floorPlan.description || ''
      },
      ownerDetails: {
        name: ownerDetails.name || '',
        phoneNumber: ownerDetails.phoneNumber || '',
        email: ownerDetails.email || '',
        reasonForSelling: ownerDetails.reasonForSelling || ''
      },
      legalDetails: {
        ownershipType: legalDetails.ownershipType || null,
        reraRegistered: legalDetails.reraRegistered || false,
        reraNumber: legalDetails.reraNumber || '',
        khataCertificate: legalDetails.khataCertificate || false,
        encumbranceCertificate: legalDetails.encumbranceCertificate || false,
        occupancyCertificate: legalDetails.occupancyCertificate || false
      },
      viewingSchedule: viewingSchedule,
      contactPreference: req.body.contactPreference && Array.isArray(req.body.contactPreference)
        ? req.body.contactPreference
        : ["call", "whatsapp"],
      viewCount: 0,
      inquiryCount: 0,
      favoriteCount: 0,
      metaTitle: req.body.metaTitle || '',
      metaDescription: req.body.metaDescription || '',
      slug: req.body.slug || '', // Will be auto-generated if empty
      displayOrder: Number(req.body.displayOrder) || 0,
      createdBy: req.body.createdBy,
      parentProperty: req.body.parentProperty || null
    };

    console.log('Creating Property Unit with data:', JSON.stringify(propertyUnitData, null, 2));

    // === CREATE PROPERTY UNIT IN DATABASE ===
    const newPropertyUnit = await PropertyUnit.create(propertyUnitData);

    // === UPDATE USER'S POSTED PROPERTIES ===
    try {
      const foundUser = await User.findById(req.body.createdBy);
      if (foundUser) {
        const alreadyExists = foundUser.postedProperties.some(
          item => item.property && item.property.toString() === newPropertyUnit._id.toString()
        );
        
        if (!alreadyExists) {
          foundUser.postedProperties.push({
            property: newPropertyUnit._id,
            postedAt: newPropertyUnit.createdAt,
            status: 'active',
            propertyType: 'unit'
          });
          await foundUser.save();
          console.log(`✓ Property Unit ${newPropertyUnit._id} added to user ${foundUser._id}'s postedProperties`);
        }
      }
    } catch (userUpdateError) {
      console.error('Error updating user postedProperties:', userUpdateError);
      // Continue even if user update fails
    }

    // === SUCCESS RESPONSE ===
    const response = {
      success: true,
      message: "Property unit created successfully via n8n",
      data: newPropertyUnit,
      n8nId: req.body.n8nId || req.body.externalId || null,
      imagesProcessed: images.length,
      watermarkedImages: images.filter(img => img.watermarked).length
    };

    console.log('=== N8N PROPERTY UNIT CREATION SUCCESS ===');
    console.log(`Processed ${images.length} images, ${response.watermarkedImages} with watermark`);
    res.status(201).json(response);

  } catch (error) {
    console.error('=== N8N PROPERTY UNIT CREATION ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors,
        validationError: true
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate property unit detected",
        duplicateError: true
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "Server error while creating property unit via n8n",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Helper function to apply watermark to existing Cloudinary URL
function applyWatermarkToCloudinaryUrl(originalUrl) {
  if (!originalUrl || !originalUrl.includes('cloudinary.com')) {
    return originalUrl;
  }
  
  // Parse the Cloudinary URL
  const urlParts = originalUrl.split('/upload/');
  if (urlParts.length !== 2) return originalUrl;
  
  const baseUrl = urlParts[0];
  const imagePath = urlParts[1];
  
  // Check if URL already has transformations
  if (imagePath.includes('/')) {
    const [transformations, ...rest] = imagePath.split('/');
    
    // Add watermark to existing transformations
    const newTransformations = transformations + ',l_text:Arial_40_bold:CLEARTITLE1,co_white,bo_2px_solid_rgb:00000040,g_south,y_20';
    return `${baseUrl}/upload/${newTransformations}/${rest.join('/')}`;
  }
  
  // Add watermark transformation to URL
  return `${baseUrl}/upload/l_text:Arial_40_bold:CLEARTITLE1,co_white,bo_2px_solid_rgb:00000040,g_south,y_20/${imagePath}`;
}

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

    // Check permissions - Updated to match your User model
    const isOwner = req.user._id.equals(propertyUnit.createdBy);
    const isAdmin = req.user.isAdmin === true; // Changed from checking userType to isAdmin boolean
    
    // Allow if user is either owner OR admin
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

    // Admin-only fields - only restrict if user is NOT admin
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
getFeaturedPropertyUnits,
createPropertyUnitN8n
};