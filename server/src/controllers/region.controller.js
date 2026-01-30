const Region = require('../models/Region');
const User = require('../models/User');

// @desc    Get all regions
// @route   GET /api/regions
// @access  Private
exports.getRegions = async (req, res, next) => {
  try {
    const regions = await Region.find({ isActive: true })
      .populate('managerId', 'name email');
    
    res.json({
      success: true,
      data: regions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get region by ID
// @route   GET /api/regions/:id
// @access  Private
exports.getRegion = async (req, res, next) => {
  try {
    const region = await Region.findById(req.params.id)
      .populate('managerId', 'name email');
    
    if (!region) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }
    
    res.json({
      success: true,
      data: region
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new region
// @route   POST /api/regions
// @access  Private (Admin)
exports.createRegion = async (req, res, next) => {
  try {
    const { name, managerId, description } = req.body;

    // Check if region already exists
    const existingRegion = await Region.findOne({ name });
    if (existingRegion) {
      return res.status(400).json({
        success: false,
        message: 'Region with this name already exists'
      });
    }

    // Validate manager if provided
    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager) {
        return res.status(400).json({
          success: false,
          message: 'Regional manager not found'
        });
      }
      
      if (manager.role !== 'regional_manager') {
        return res.status(400).json({
          success: false,
          message: 'User must have regional_manager role'
        });
      }
    }

    const region = await Region.create({
      name,
      managerId: managerId || null,
      description,
      isActive: true
    });

    // Update manager's region assignment if provided
    if (managerId) {
      await User.findByIdAndUpdate(managerId, { region: name });
    }

    const createdRegion = await Region.findById(region._id)
      .populate('managerId', 'name email');

    res.status(201).json({
      success: true,
      message: 'Region created successfully',
      data: createdRegion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update region
// @route   PUT /api/regions/:id
// @access  Private (Admin)
exports.updateRegion = async (req, res, next) => {
  try {
    const { managerId, description } = req.body;
    const region = await Region.findById(req.params.id);

    if (!region) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }

    // Validate new manager if provided
    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager) {
        return res.status(400).json({
          success: false,
          message: 'Regional manager not found'
        });
      }
      
      if (manager.role !== 'regional_manager') {
        return res.status(400).json({
          success: false,
          message: 'User must have regional_manager role'
        });
      }

      // Remove region from old manager
      if (region.managerId && region.managerId.toString() !== managerId) {
        await User.findByIdAndUpdate(region.managerId, { $unset: { region: '' } });
      }

      // Assign region to new manager
      await User.findByIdAndUpdate(managerId, { region: region.name });
    }

    // Update region
    region.managerId = managerId !== undefined ? managerId : region.managerId;
    if (description !== undefined) region.description = description;

    await region.save();

    const updatedRegion = await Region.findById(region._id)
      .populate('managerId', 'name email');

    res.json({
      success: true,
      message: 'Region updated successfully',
      data: updatedRegion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete region
// @route   DELETE /api/regions/:id
// @access  Private (Admin)
exports.deleteRegion = async (req, res, next) => {
  try {
    const region = await Region.findById(req.params.id);

    if (!region) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }

    // Check if region has users
    const usersInRegion = await User.countDocuments({ region: region.name });
    if (usersInRegion > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete region with ${usersInRegion} assigned users. Reassign users first.`
      });
    }

    // Remove manager assignment
    if (region.managerId) {
      await User.findByIdAndUpdate(region.managerId, { $unset: { region: '' } });
    }

    region.isActive = false;
    await region.save();

    res.json({
      success: true,
      message: 'Region deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get region with stats
// @route   GET /api/regions/:id/stats
// @access  Private
exports.getRegionStats = async (req, res, next) => {
  try {
    const region = await Region.findById(req.params.id)
      .populate('managerId', 'name email');

    if (!region) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }

    // Get users in region
    const users = await User.find({ region: region.name });
    const teamLeaders = users.filter(u => u.role === 'team_leader');
    const fieldOfficers = users.filter(u => u.role === 'field_officer');
    const userIds = users.map(u => u._id);

    // Get sales for this region
    const Sale = require('../models/Sale');
    const sales = await Sale.find({
      $or: [
        { foId: { $in: userIds } },
        { createdBy: { $in: userIds } }
      ]
    });

    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.saleAmount || 0), 0);

    res.json({
      success: true,
      data: {
        region,
        stats: {
          totalUsers: users.length,
          teamLeaders: teamLeaders.length,
          fieldOfficers: fieldOfficers.length,
          totalSales,
          totalRevenue
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
