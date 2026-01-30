const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.FIELD_OFFICER
  },
  region: {
    type: String,
    required: [true, 'Region is required']
  },
  phone: {
    type: String,
    trim: true
  },
  foCode: {
    type: String,
    unique: true,
    sparse: true // Allows null values for non-FO users
  },
  teamLeaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  regionalManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full user hierarchy
userSchema.methods.getHierarchy = async function() {
  const hierarchy = { user: this };
  
  if (this.teamLeaderId) {
    hierarchy.teamLeader = await mongoose.model('User').findById(this.teamLeaderId);
  }
  
  if (this.regionalManagerId) {
    hierarchy.regionalManager = await mongoose.model('User').findById(this.regionalManagerId);
  }
  
  return hierarchy;
};

module.exports = mongoose.model('User', userSchema);
