const EmployeeUser = require("../models/EmployeeUser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const fs=require('fs')
// In employeeuser.js - register function
exports.register = async (req, res) => {
  try {
    const { username, email, password, phoneNumber, userType, isAdmin } = req.body;

    if (!username || !email || !password || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const existingEmployee = await EmployeeUser.findOne({
      $or: [{ email }, { username }, { phoneNumber }]
    });

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: "Employee already exists with this email, username, or phone number"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let userImage = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "employee_profiles",
        transformation: [{ width: 500, height: 500, crop: "limit" }]
      });
      userImage = result.secure_url;
    }

    const employee = new EmployeeUser({
      username,
      email,
      password: hashedPassword,
      phoneNumber,
      userImage,
      userType: userType || "employee",
      isAdmin: isAdmin === true || isAdmin === "true" || false,
      dailyRecords: []
    });

    await employee.save();

    // Generate JWT token with 'id' field
    const token = jwt.sign(
      { 
        id: employee._id,  // Important: use 'id' field
        userId: employee._id, 
        username: employee.username,
        email: employee.email,
        userType: employee.userType,
        isAdmin: employee.isAdmin
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      success: true,
      message: "Employee registered successfully",
      token,
      employee: {
        id: employee._id,
        username: employee.username,
        email: employee.email,
        phoneNumber: employee.phoneNumber,
        userImage: employee.userImage,
        userType: employee.userType,
        isAdmin: employee.isAdmin,
        createdAt: employee.createdAt
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Username, email, or phone number already exists"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message
    });
  }
};
// In employeeuser.js - login function
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const employee = await EmployeeUser.findOne({ email });

    if (!employee) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const isPasswordValid = await bcrypt.compare(password, employee.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Update login time for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      employee.dailyRecords.push({
        date: today,
        loginTime: new Date(),
        logoutTime: null,
        workItems: [],
        dailySummary: "",
        dayCompleted: false
      });
      await employee.save();
    } else if (!todayRecord.loginTime) {
      todayRecord.loginTime = new Date();
      await employee.save();
    }

    // Generate JWT token - Make sure to include 'id' field
    const token = jwt.sign(
      { 
        id: employee._id,  // This is important - must be 'id'
        userId: employee._id, 
        username: employee.username,
        email: employee.email,
        userType: employee.userType,
        isAdmin: employee.isAdmin
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      employee: {
        id: employee._id,
        username: employee.username,
        email: employee.email,
        phoneNumber: employee.phoneNumber,
        userImage: employee.userImage,
        userType: employee.userType,
        isAdmin: employee.isAdmin,
        dailyRecords: employee.dailyRecords
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message
    });
  }
};

// Logout Employee User
exports.logout = async (req, res) => {
  try {
    const employeeId = req.user._id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const employee = await EmployeeUser.findById(employeeId);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const todayRecordIndex = employee.dailyRecords.findIndex(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (todayRecordIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "No active session found for today"
      });
    }

    employee.dailyRecords[todayRecordIndex].logoutTime = new Date();
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Logout successful"
    });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
      error: error.message
    });
  }
};

// Get Employee Profile
exports.getProfile = async (req, res) => {
  try {
    const employee = await EmployeeUser.findById(req.user._id).select("-password");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      employee
    });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Update Employee Profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, phoneNumber } = req.body;
    const updates = {};

    if (username) updates.username = username;
    if (phoneNumber) updates.phoneNumber = phoneNumber;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "employee_profiles",
        transformation: [{ width: 500, height: 500, crop: "limit" }]
      });
      updates.userImage = result.secure_url;
    }

    const employee = await EmployeeUser.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      employee
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

/// ==================== WORK ITEMS METHODS ====================

// Add a new work item to today's record
exports.addWorkItem = async (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description || description.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Work description is required"
      });
    }

    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      todayRecord = {
        date: today,
        loginTime: new Date(),
        logoutTime: null,
        workItems: [],
        dailySummary: "",
        dayCompleted: false,
        dailyImages: []
      };
      employee.dailyRecords.push(todayRecord);
    }

    const newWorkItem = {
      description: description.trim(),
      image: null,
      completed: false,
      completedAt: null,
      createdAt: new Date()
    };
    
    todayRecord.workItems.push(newWorkItem);
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Work item added successfully",
      workItem: newWorkItem,
      workItems: todayRecord.workItems
    });
  } catch (error) {
    console.error("Add work item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Upload image for a specific work item
exports.uploadWorkItemImage = async (req, res) => {
  try {
    const { workItemIndex } = req.body;
    
    if (workItemIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Work item index is required"
      });
    }

    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      return res.status(404).json({
        success: false,
        message: "No record found for today"
      });
    }

    if (!todayRecord.workItems[workItemIndex]) {
      return res.status(404).json({
        success: false,
        message: "Work item not found"
      });
    }

    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `employee_work/${employee._id}`,
        transformation: [{ width: 800, height: 800, crop: "limit" }]
      });
      imageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    todayRecord.workItems[workItemIndex].image = imageUrl;
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      workItem: todayRecord.workItems[workItemIndex]
    });
  } catch (error) {
    console.error("Upload work item image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Upload daily image routine
exports.uploadDailyImage = async (req, res) => {
  try {
    const { imageType, caption } = req.body;
    
    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      todayRecord = {
        date: today,
        loginTime: new Date(),
        logoutTime: null,
        workItems: [],
        dailySummary: "",
        dayCompleted: false,
        dailyImages: []
      };
      employee.dailyRecords.push(todayRecord);
    }

    if (!todayRecord.dailyImages) {
      todayRecord.dailyImages = [];
    }

    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `employee_daily/${employee._id}/${today.toISOString().split('T')[0]}`,
        transformation: [{ width: 1200, height: 1200, crop: "limit" }]
      });
      imageUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    const newImage = {
      imageUrl,
      imageType: imageType || "general",
      caption: caption || "",
      uploadedAt: new Date()
    };

    todayRecord.dailyImages.push(newImage);
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Daily image uploaded successfully",
      image: newImage,
      dailyImages: todayRecord.dailyImages
    });
  } catch (error) {
    console.error("Upload daily image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get daily images
exports.getDailyImages = async (req, res) => {
  try {
    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    res.status(200).json({
      success: true,
      dailyImages: todayRecord?.dailyImages || [],
      hasRecord: !!todayRecord
    });
  } catch (error) {
    console.error("Get daily images error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Delete daily image
exports.deleteDailyImage = async (req, res) => {
  try {
    const { imageIndex } = req.body;
    
    if (imageIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Image index is required"
      });
    }

    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord || !todayRecord.dailyImages[imageIndex]) {
      return res.status(404).json({
        success: false,
        message: "Image not found"
      });
    }

    // Delete from Cloudinary if needed
    const imageUrl = todayRecord.dailyImages[imageIndex].imageUrl;
    if (imageUrl) {
      const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    todayRecord.dailyImages.splice(imageIndex, 1);
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Image deleted successfully",
      dailyImages: todayRecord.dailyImages
    });
  } catch (error) {
    console.error("Delete daily image error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Mark work item as completed
exports.completeWorkItem = async (req, res) => {
  try {
    const { workItemIndex } = req.body;
    
    if (workItemIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Work item index is required"
      });
    }

    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      return res.status(404).json({
        success: false,
        message: "No record found for today"
      });
    }

    if (!todayRecord.workItems[workItemIndex]) {
      return res.status(404).json({
        success: false,
        message: "Work item not found"
      });
    }

    const workItem = todayRecord.workItems[workItemIndex];
    workItem.completed = true;
    workItem.completedAt = new Date();

    const allCompleted = todayRecord.workItems.every(item => item.completed === true);
    if (allCompleted) {
      todayRecord.dayCompleted = true;
    }

    await employee.save();

    res.status(200).json({
      success: true,
      message: "Work item marked as completed",
      workItem,
      allCompleted,
      dayCompleted: todayRecord.dayCompleted
    });
  } catch (error) {
    console.error("Complete work item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Update work item description
exports.updateWorkItem = async (req, res) => {
  try {
    const { workItemIndex, description } = req.body;
    
    if (workItemIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Work item index is required"
      });
    }

    if (!description || description.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Description is required"
      });
    }

    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      return res.status(404).json({
        success: false,
        message: "No record found for today"
      });
    }

    if (!todayRecord.workItems[workItemIndex]) {
      return res.status(404).json({
        success: false,
        message: "Work item not found"
      });
    }

    todayRecord.workItems[workItemIndex].description = description.trim();
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Work item updated successfully",
      workItem: todayRecord.workItems[workItemIndex]
    });
  } catch (error) {
    console.error("Update work item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Delete work item
exports.deleteWorkItem = async (req, res) => {
  try {
    const { workItemIndex } = req.body;
    
    if (workItemIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: "Work item index is required"
      });
    }

    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      return res.status(404).json({
        success: false,
        message: "No record found for today"
      });
    }

    if (!todayRecord.workItems[workItemIndex]) {
      return res.status(404).json({
        success: false,
        message: "Work item not found"
      });
    }

    todayRecord.workItems.splice(workItemIndex, 1);
    
    if (todayRecord.workItems.length === 0) {
      todayRecord.dayCompleted = false;
    } else {
      const allCompleted = todayRecord.workItems.every(item => item.completed === true);
      todayRecord.dayCompleted = allCompleted;
    }
    
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Work item deleted successfully",
      workItems: todayRecord.workItems,
      dayCompleted: todayRecord.dayCompleted
    });
  } catch (error) {
    console.error("Delete work item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get today's work items
exports.getTodayWorkItems = async (req, res) => {
  try {
    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      return res.status(200).json({
        success: true,
        hasRecord: false,
        workItems: [],
        dailyImages: [],
        loginTime: null,
        logoutTime: null,
        dayCompleted: false,
        dailySummary: ""
      });
    }

    res.status(200).json({
      success: true,
      hasRecord: true,
      workItems: todayRecord.workItems,
      dailyImages: todayRecord.dailyImages || [],
      loginTime: todayRecord.loginTime,
      logoutTime: todayRecord.logoutTime,
      dayCompleted: todayRecord.dayCompleted,
      dailySummary: todayRecord.dailySummary || ""
    });
  } catch (error) {
    console.error("Get today work items error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Update daily summary
exports.updateDailySummary = async (req, res) => {
  try {
    const { dailySummary } = req.body;
    
    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    if (!todayRecord) {
      return res.status(404).json({
        success: false,
        message: "No record found for today"
      });
    }

    todayRecord.dailySummary = dailySummary || "";
    await employee.save();

    res.status(200).json({
      success: true,
      message: "Daily summary updated successfully",
      dailySummary: todayRecord.dailySummary
    });
  } catch (error) {
    console.error("Update daily summary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get today's record for logged-in employee
exports.getTodayRecord = async (req, res) => {
  try {
    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayRecord = employee.dailyRecords.find(
      record => record.date && record.date.toDateString() === today.toDateString()
    );

    res.status(200).json({
      success: true,
      record: todayRecord || null
    });
  } catch (error) {
    console.error("Get today record error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get employee statistics
exports.getEmployeeStats = async (req, res) => {
  try {
    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const records = employee.dailyRecords;
    const totalDays = records.length;
    
    let totalWorkItems = 0;
    let completedWorkItems = 0;
    let totalImages = 0;
    
    records.forEach(record => {
      totalWorkItems += record.workItems.length;
      completedWorkItems += record.workItems.filter(item => item.completed === true).length;
      totalImages += (record.dailyImages || []).length;
    });
    
    const completedDays = records.filter(r => r.dayCompleted === true).length;
    const completionRate = totalDays > 0 ? (completedDays / totalDays) * 100 : 0;
    const workCompletionRate = totalWorkItems > 0 ? (completedWorkItems / totalWorkItems) * 100 : 0;
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const record = records.find(r => r.date.toDateString() === date.toDateString());
      last7Days.push({
        date: date.toISOString().split('T')[0],
        hasRecord: !!record,
        workItemsCount: record ? record.workItems.length : 0,
        completedItems: record ? record.workItems.filter(item => item.completed === true).length : 0,
        imagesCount: record ? (record.dailyImages || []).length : 0,
        dayCompleted: record ? record.dayCompleted : false
      });
    }

    res.status(200).json({
      success: true,
      stats: {
        totalDays,
        completedDays,
        pendingDays: totalDays - completedDays,
        completionRate: completionRate.toFixed(2),
        totalWorkItems,
        completedWorkItems,
        pendingWorkItems: totalWorkItems - completedWorkItems,
        workCompletionRate: workCompletionRate.toFixed(2),
        totalImages,
        totalRecords: records.length
      },
      recentActivity: last7Days
    });
  } catch (error) {
    console.error("Get employee stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, phoneNumber } = req.body;
    
    const employee = await EmployeeUser.findById(req.user._id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    if (username) employee.username = username;
    if (phoneNumber) employee.phoneNumber = phoneNumber;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `employee_profiles/${employee._id}`,
        transformation: [{ width: 500, height: 500, crop: "limit" }]
      });
      employee.userImage = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    await employee.save();

    const employeeResponse = employee.toObject();
    delete employeeResponse.password;

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      employee: employeeResponse
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get all employees (Admin only)
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await EmployeeUser.find().select("-password");
    
    res.status(200).json({
      success: true,
      count: employees.length,
      employees
    });
  } catch (error) {
    console.error("Get all employees error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get employee by ID (Admin/Manager only)
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await EmployeeUser.findById(req.params.id).select("-password");
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }
    
    res.status(200).json({
      success: true,
      employee
    });
  } catch (error) {
    console.error("Get employee by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};