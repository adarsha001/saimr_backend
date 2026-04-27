// backend/controllers/adminController.js
const EmployeeUser = require("../models/EmployeeUser");
const mongoose = require("mongoose");

// Get all employees with their records
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await EmployeeUser.find().select("-password");
    
    // Format employee data for admin view
    const formattedEmployees = employees.map(emp => ({
      _id: emp._id,
      username: emp.username,
      email: emp.email,
      phoneNumber: emp.phoneNumber,
      userImage: emp.userImage,
      userType: emp.userType,
      isAdmin: emp.isAdmin,
      createdAt: emp.createdAt,
      totalWorkDays: emp.dailyRecords.length,
      completedDays: emp.dailyRecords.filter(r => r.dayCompleted === true).length,
      totalWorkItems: emp.dailyRecords.reduce((sum, r) => sum + r.workItems.length, 0),
      completedWorkItems: emp.dailyRecords.reduce((sum, r) => sum + r.workItems.filter(i => i.completed).length, 0)
    }));
    
    res.status(200).json({
      success: true,
      count: employees.length,
      employees: formattedEmployees
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

// Get employee by ID with full details
exports.getEmployeeById = async (req, res) => {
  try {
    const employee = await EmployeeUser.findById(req.params.id).select("-password");
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }
    
    // Format daily records for calendar view
    const formattedRecords = employee.dailyRecords.map(record => ({
      _id: record._id,
      date: record.date,
      loginTime: record.loginTime,
      logoutTime: record.logoutTime,
      dayCompleted: record.dayCompleted,
      dailySummary: record.dailySummary,
      workItems: record.workItems,
      workItemsCount: record.workItems.length,
      completedCount: record.workItems.filter(i => i.completed).length,
      completionRate: record.workItems.length > 0 
        ? (record.workItems.filter(i => i.completed).length / record.workItems.length) * 100 
        : 0
    }));
    
    // Calculate overall stats
    const totalWorkItems = employee.dailyRecords.reduce((sum, r) => sum + r.workItems.length, 0);
    const completedWorkItems = employee.dailyRecords.reduce((sum, r) => sum + r.workItems.filter(i => i.completed).length, 0);
    const completedDays = employee.dailyRecords.filter(r => r.dayCompleted === true).length;
    
    res.status(200).json({
      success: true,
      employee: {
        _id: employee._id,
        username: employee.username,
        email: employee.email,
        phoneNumber: employee.phoneNumber,
        userImage: employee.userImage,
        userType: employee.userType,
        isAdmin: employee.isAdmin,
        createdAt: employee.createdAt,
        totalWorkDays: employee.dailyRecords.length,
        completedDays: completedDays,
        totalWorkItems: totalWorkItems,
        completedWorkItems: completedWorkItems,
        workCompletionRate: totalWorkItems > 0 ? (completedWorkItems / totalWorkItems) * 100 : 0,
        dayCompletionRate: employee.dailyRecords.length > 0 ? (completedDays / employee.dailyRecords.length) * 100 : 0,
        dailyRecords: formattedRecords
      }
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

// Get employee records for a specific date range
exports.getEmployeeRecordsByDateRange = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const employee = await EmployeeUser.findById(id).select("-password");
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }
    
    let records = employee.dailyRecords;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      records = records.filter(record => record.date >= start && record.date <= end);
    }
    
    res.status(200).json({
      success: true,
      records: records.map(record => ({
        date: record.date,
        loginTime: record.loginTime,
        logoutTime: record.logoutTime,
        dayCompleted: record.dayCompleted,
        dailySummary: record.dailySummary,
        workItemsCount: record.workItems.length,
        completedCount: record.workItems.filter(i => i.completed).length,
        workItems: record.workItems
      }))
    });
  } catch (error) {
    console.error("Get employee records by date range error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Get all employees summary for dashboard
exports.getAdminDashboardStats = async (req, res) => {
  try {
    const employees = await EmployeeUser.find();
    
    const totalEmployees = employees.length;
    let totalWorkDays = 0;
    let totalCompletedDays = 0;
    let totalWorkItems = 0;
    let totalCompletedWorkItems = 0;
    
    employees.forEach(emp => {
      totalWorkDays += emp.dailyRecords.length;
      totalCompletedDays += emp.dailyRecords.filter(r => r.dayCompleted === true).length;
      emp.dailyRecords.forEach(record => {
        totalWorkItems += record.workItems.length;
        totalCompletedWorkItems += record.workItems.filter(i => i.completed).length;
      });
    });
    
    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let activeToday = 0;
    employees.forEach(emp => {
      const hasTodayRecord = emp.dailyRecords.some(
        record => record.date.toDateString() === today.toDateString()
      );
      if (hasTodayRecord) activeToday++;
    });
    
    res.status(200).json({
      success: true,
      stats: {
        totalEmployees,
        totalWorkDays,
        totalCompletedDays,
        totalWorkItems,
        totalCompletedWorkItems,
        activeToday,
        overallWorkCompletionRate: totalWorkItems > 0 ? (totalCompletedWorkItems / totalWorkItems) * 100 : 0,
        overallDayCompletionRate: totalWorkDays > 0 ? (totalCompletedDays / totalWorkDays) * 100 : 0
      }
    });
  } catch (error) {
    console.error("Get admin dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Update employee status (activate/deactivate)
exports.updateEmployeeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const employee = await EmployeeUser.findById(id);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }
    
    employee.isActive = isActive;
    await employee.save();
    
    res.status(200).json({
      success: true,
      message: `Employee ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error("Update employee status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};