const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// @desc    Get all activity logs with filtering
// @route   GET /api/activity-logs
// @access  Private
exports.getActivityLogs = async (req, res, next) => {
  try {
    const { type, userId, entityType, startDate, endDate, page = 1, limit = 50, search } = req.query;

    let query = {};

    // Filter by entity type (sale, inventory, user, commission, product, system, allocation)
    if (entityType) {
      query.entityType = entityType;
    }

    // Filter by user
    if (userId) {
      query.userId = userId;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Search in action or details
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: 'i' } },
        { 'details.description': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find(query)
      .populate('userId', 'name email role foCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity log by ID
// @route   GET /api/activity-logs/:id
// @access  Private
exports.getActivityLog = async (req, res, next) => {
  try {
    const log = await ActivityLog.findById(req.params.id)
      .populate('userId', 'name email role')
      .populate('entityId');

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create activity log
// @route   POST /api/activity-logs
// @access  Private
exports.createActivityLog = async (req, res, next) => {
  try {
    const { action, entityType, entityId, details } = req.body;

    // Validate required fields
    if (!action || !entityType) {
      return res.status(400).json({
        success: false,
        message: 'action and entityType are required'
      });
    }

    const newLog = await ActivityLog.create({
      userId: req.user._id,
      action,
      entityType,
      entityId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    await newLog.populate('userId', 'name email role');

    res.status(201).json({
      success: true,
      data: newLog
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity logs for current user
// @route   GET /api/activity-logs/me/logs
// @access  Private
exports.getMyActivityLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, entityType, startDate, endDate } = req.query;

    let query = { userId: req.user._id };

    if (entityType) {
      query.entityType = entityType;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments(query);

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity logs for a specific entity
// @route   GET /api/activity-logs/entity/:entityType/:entityId
// @access  Private
exports.getEntityActivityLogs = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const logs = await ActivityLog.find({ 
      entityType,
      entityId 
    })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ActivityLog.countDocuments({ entityType, entityId });

    res.json({
      success: true,
      count: logs.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: logs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete activity log (Admin only)
// @route   DELETE /api/activity-logs/:id
// @access  Private (Admin)
exports.deleteActivityLog = async (req, res, next) => {
  try {
    // Check if admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete activity logs'
      });
    }

    const log = await ActivityLog.findByIdAndDelete(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    res.json({
      success: true,
      message: 'Activity log deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get activity summary/stats
// @route   GET /api/activity-logs/stats/summary
// @access  Private
exports.getActivityStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) {
        dateQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        dateQuery.createdAt.$lte = new Date(endDate);
      }
    }

    // Count by entity type
    const byType = await ActivityLog.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$entityType', count: { $sum: 1 } } }
    ]);

    // Count by user
    const byUser = await ActivityLog.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Total logs
    const total = await ActivityLog.countDocuments(dateQuery);

    res.json({
      success: true,
      data: {
        total,
        byType,
        topUsers: byUser
      }
    });
  } catch (error) {
    next(error);
  }
};
