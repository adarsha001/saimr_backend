const mongoose = require("mongoose");


const workItemSchema = new mongoose.Schema({
  image: { type: String, default: null },
  description: { type: String, default: "", trim: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null }, 
  createdAt: { type: Date, default: Date.now }
});

const dailyRecordSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  loginTime: { type: Date, required: true },
  logoutTime: { type: Date, default: null },
  
 
  workItems: { 
    type: [workItemSchema], 
    default: [] 
  },
  
  // Optional: Overall daily summary
  dailySummary: { 
    type: String, 
    default: "", 
    trim: true 
  },
  
  // Optional: Track if day is fully completed
  dayCompleted: { 
    type: Boolean, 
    default: false 
  }
});

const employeeUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phoneNumber: { 
    type: String, 
    required: true, 
    unique: true,
    match: /^[0-9+\-\s()]+$/
  },
  userImage: { type: String, default: null },
  userType: { type: String, default: "employee", enum: ["employee", "admin", "manager"] },
  isAdmin: { type: Boolean, default: false },
  dailyRecords: { type: [dailyRecordSchema], default: [] }
}, { 
  timestamps: true 
});

// Indexes
employeeUserSchema.index({ phoneNumber: 1 });
employeeUserSchema.index({ userType: 1 });
employeeUserSchema.index({ email: 1 });
employeeUserSchema.index({ username: 1 });
employeeUserSchema.index({ "dailyRecords.date": 1 });

module.exports = mongoose.model("EmployeeUser", employeeUserSchema);