const Commission = require('../models/Commission');
const Sale = require('../models/Sale');
const User = require('../models/User');
const Product = require('../models/Product');
const IMEI = require('../models/IMEI');
const { USER_ROLES, COMMISSION_STATUS } = require('../config/constants');

// @desc    Get all commissions with full details
// @route   GET /api/commissions
// @access  Private
exports.getCommissions = async (req, res, next) => {
  try {
    const { status, userId, role, startDate, endDate, page = 1, limit = 100 } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (userId) {
      query.userId = userId;
    }

    if (role) {
      query.role = role;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      query.userId = req.user._id;
    } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
      const teamMembers = await User.find({ teamLeaderId: req.user._id }).select('_id');
      const teamMemberIds = teamMembers.map(m => m._id);
      query.userId = { $in: [req.user._id, ...teamMemberIds] };
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      const regionUsers = await User.find({ region: req.user.region }).select('_id');
      const regionUserIds = regionUsers.map(u => u._id);
      query.userId = { $in: regionUserIds };
    }

    const skip = (page - 1) * limit;

    const commissions = await Commission.find(query)
      .populate({
        path: 'saleId',
        select: 'receiptNumber saleAmount productId imeiId imei createdAt',
        populate: [
          { path: 'productId', select: 'name category' },
          { path: 'imeiId', select: 'imei' }
        ]
      })
      .populate('userId', 'name email role region')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Commission.countDocuments(query);

    // Calculate totals by status
    const totals = await Commission.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform commissions to include full details
    const transformedCommissions = commissions.map(c => {
      const commission = c.toObject();
      return {
        id: commission._id.toString(),
        saleId: commission.saleId?._id?.toString() || commission.saleId?.toString() || '',
        userId: commission.userId?._id?.toString() || commission.userId?.toString() || '',
        userName: commission.userId?.name || 'Unknown User',
        role: commission.role,
        productId: commission.saleId?.productId?._id?.toString() || '',
        productName: commission.saleId?.productId?.name || 'Unknown Product',
        imei: commission.saleId?.imei || commission.saleId?.imeiId?.imei || '',
        amount: commission.amount,
        status: commission.status,
        paidAt: commission.paidAt,
        approvedAt: commission.approvedAt,
        approvedBy: commission.approvedBy?.name,
        createdAt: commission.createdAt,
        region: commission.userId?.region
      };
    });

    res.json({
      success: true,
      count: commissions.length,
      total,
      totals,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: transformedCommissions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user's commissions
// @route   GET /api/commissions/my-commissions
// @access  Private
exports.getMyCommissions = async (req, res, next) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 100 } = req.query;

    let query = { userId: req.user._id };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const commissions = await Commission.find(query)
      .populate({
        path: 'saleId',
        select: 'receiptNumber saleAmount productId imeiId imei createdAt',
        populate: [
          { path: 'productId', select: 'name category' },
          { path: 'imeiId', select: 'imei' }
        ]
      })
      .populate('userId', 'name email role region')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Commission.countDocuments(query);

    const totals = await Commission.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const transformedCommissions = commissions.map(c => {
      const commission = c.toObject();
      return {
        id: commission._id.toString(),
        saleId: commission.saleId?._id?.toString() || commission.saleId?.toString() || '',
        userId: commission.userId?._id?.toString() || commission.userId?.toString() || '',
        userName: commission.userId?.name || 'Unknown User',
        role: commission.role,
        productId: commission.saleId?.productId?._id?.toString() || '',
        productName: commission.saleId?.productId?.name || 'Unknown Product',
        imei: commission.saleId?.imei || commission.saleId?.imeiId?.imei || '',
        amount: commission.amount,
        status: commission.status,
        paidAt: commission.paidAt,
        approvedAt: commission.approvedAt,
        approvedBy: commission.approvedBy?.name,
        createdAt: commission.createdAt,
        region: commission.userId?.region
      };
    });

    res.json({
      success: true,
      count: commissions.length,
      total,
      totals,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: transformedCommissions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve commission
// @route   PUT /api/commissions/:id/approve
// @access  Private (Admin)
exports.approveCommission = async (req, res, next) => {
  try {
    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found'
      });
    }

    if (commission.status !== COMMISSION_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: 'Commission is not pending'
      });
    }

    commission.status = COMMISSION_STATUS.APPROVED;
    commission.approvedBy = req.user._id;
    commission.approvedAt = new Date();
    await commission.save();

    res.json({
      success: true,
      data: commission
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark commission as paid
// @route   PUT /api/commissions/:id/pay
// @access  Private (Admin)
exports.payCommission = async (req, res, next) => {
  try {
    const { paymentReference } = req.body;

    const commission = await Commission.findById(req.params.id);

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found'
      });
    }

    if (commission.status === COMMISSION_STATUS.PAID) {
      return res.status(400).json({
        success: false,
        message: 'Commission already paid'
      });
    }

    commission.status = COMMISSION_STATUS.PAID;
    commission.paidAt = new Date();
    commission.paymentReference = paymentReference;
    await commission.save();

    res.json({
      success: true,
      data: commission
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk approve commissions
// @route   PUT /api/commissions/bulk-approve
// @access  Private (Admin)
exports.bulkApproveCommissions = async (req, res, next) => {
  try {
    const { commissionIds, ids } = req.body;
    const idList = commissionIds || ids || [];

    const result = await Commission.updateMany(
      {
        _id: { $in: idList },
        status: COMMISSION_STATUS.PENDING
      },
      {
        $set: {
          status: COMMISSION_STATUS.APPROVED,
          approvedBy: req.user._id,
          approvedAt: new Date()
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} commissions approved`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk pay commissions
// @route   PUT /api/commissions/bulk-pay
// @access  Private (Admin)
exports.bulkPayCommissions = async (req, res, next) => {
  try {
    const { commissionIds, ids, paymentReference } = req.body;
    const idList = commissionIds || ids || [];

    const result = await Commission.updateMany(
      {
        _id: { $in: idList },
        status: { $in: [COMMISSION_STATUS.PENDING, COMMISSION_STATUS.APPROVED] }
      },
      {
        $set: {
          status: COMMISSION_STATUS.PAID,
          paidAt: new Date(),
          paymentReference
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} commissions marked as paid`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get commission summary by user
// @route   GET /api/commissions/summary/:userId
// @access  Private (Admin, user themselves)
exports.getCommissionSummary = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Check authorization
    if (req.user.role !== USER_ROLES.ADMIN && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const summary = await Commission.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalEarned = await Commission.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.json({
      success: true,
      data: {
        byStatus: summary,
        totalEarned: totalEarned[0]?.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
};
