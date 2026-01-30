const User = require('../models/User');
const { USER_ROLES } = require('../config/constants');

// Generate FO Code
const generateFOCode = async () => {
  const count = await User.countDocuments({ role: USER_ROLES.FIELD_OFFICER });
  return `FO-${String(count + 1).padStart(3, '0')}`;
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin, Regional Manager)
exports.getUsers = async (req, res, next) => {
  try {
    const { role, region, isActive, search } = req.query;
    
    let query = {};

    // Apply role filter
    if (role) {
      query.role = role;
    }

    // Apply region filter based on user role
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      query.region = req.user.region;
    } else if (region) {
      query.region = region;
    }

    // Apply team filter for team leaders
    if (req.user.role === USER_ROLES.TEAM_LEADER) {
      query.$or = [
        { _id: req.user._id },
        { teamLeaderId: req.user._id }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .populate('teamLeaderId', 'name email')
      .populate('regionalManagerId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private (Admin)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, region, phone, teamLeaderId, regionalManagerId } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Prepare user data
    const userData = {
      name,
      email,
      password,
      role,
      region,
      phone,
      teamLeaderId,
      regionalManagerId,
      isActive: true
    };

    // Only add foCode for field officers
    if (role === USER_ROLES.FIELD_OFFICER) {
      userData.foCode = await generateFOCode();
    }

    const user = await User.create(userData);

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        region: user.region,
        foCode: user.foCode,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt
      },
      message: 'User created successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('teamLeaderId', 'name email')
      .populate('regionalManagerId', 'name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin)
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role, region, phone, isActive, teamLeaderId, regionalManagerId } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, region, phone, isActive, teamLeaderId, regionalManagerId },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private (Admin)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get team members (for Team Leaders)
// @route   GET /api/users/team
// @access  Private (Team Leader)
exports.getTeamMembers = async (req, res, next) => {
  try {
    const teamMembers = await User.find({
      teamLeaderId: req.user._id,
      role: USER_ROLES.FIELD_OFFICER
    });

    res.json({
      success: true,
      count: teamMembers.length,
      data: teamMembers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign FO to Team Leader
// @route   PUT /api/users/:id/assign-team-leader
// @access  Private (Admin, Regional Manager)
exports.assignTeamLeader = async (req, res, next) => {
  try {
    const { teamLeaderId } = req.body;

    const fo = await User.findById(req.params.id);
    if (!fo || fo.role !== USER_ROLES.FIELD_OFFICER) {
      return res.status(404).json({
        success: false,
        message: 'Field Officer not found'
      });
    }

    const teamLeader = await User.findById(teamLeaderId);
    if (!teamLeader || teamLeader.role !== USER_ROLES.TEAM_LEADER) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Team Leader'
      });
    }

    // Check region access for Regional Manager
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      if (fo.region !== req.user.region || teamLeader.region !== req.user.region) {
        return res.status(403).json({
          success: false,
          message: 'Cannot assign users from different regions'
        });
      }
    }

    fo.teamLeaderId = teamLeaderId;
    fo.regionalManagerId = teamLeader.regionalManagerId;
    await fo.save();

    res.json({
      success: true,
      data: fo,
      message: 'Field Officer assigned to Team Leader successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get users by region (for Regional Manager)
// @route   GET /api/users/region/:region
// @access  Private (Admin, Regional Manager)
exports.getUsersByRegion = async (req, res, next) => {
  try {
    const { region } = req.params;

    // Regional Managers can only access their region
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER && req.user.region !== region) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this region'
      });
    }

    const users = await User.find({ region })
      .populate('teamLeaderId', 'name email')
      .populate('regionalManagerId', 'name email')
      .sort({ role: 1, name: 1 });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};
