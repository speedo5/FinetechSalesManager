const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account is deactivated'
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if user has access to resource in their region
exports.checkRegionAccess = async (req, res, next) => {
  try {
    const { USER_ROLES } = require('../config/constants');
    
    // Admins have access to all regions
    if (req.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    // Regional managers can only access their region
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      req.regionFilter = { region: req.user.region };
    }

    // Team leaders can access their team's data
    if (req.user.role === USER_ROLES.TEAM_LEADER) {
      req.teamFilter = { teamLeaderId: req.user._id };
    }

    // Field officers can only access their own data
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      req.userFilter = { userId: req.user._id };
    }

    next();
  } catch (error) {
    next(error);
  }
};
