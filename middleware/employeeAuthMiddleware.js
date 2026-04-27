// backend/middleware/employeeAuthMiddleware.js
const jwt = require('jsonwebtoken');
const EmployeeUser = require('../models/EmployeeUser');

const protectEmployee = async (req, res, next) => {
  try {
    let token;

    console.log("Employee Auth Middleware - Headers:", req.headers);
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log("Token extracted:", token ? token.substring(0, 50) + "..." : "No token");
    }

    if (!token) {
      console.log("No token provided");
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);
      
      // Use EmployeeUser model instead of User
      const employee = await EmployeeUser.findById(decoded.id || decoded.userId);
      
      if (!employee) {
        console.log("Employee not found for id:", decoded.id || decoded.userId);
        return res.status(401).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      req.user = employee; // Set as user for consistency
      console.log("Employee authenticated:", employee.email);
      next();
    } catch (error) {
      console.error("Token verification failed:", error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

const authorizeEmployee = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType) && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: `Employee role ${req.user.userType} is not authorized to access this route`
      });
    }
    next();
  };
};

module.exports = { protectEmployee, authorizeEmployee };