const Sale = require('../models/Sale');
const IMEI = require('../models/IMEI');
const User = require('../models/User');
const Commission = require('../models/Commission');
const { USER_ROLES, IMEI_STATUS } = require('../config/constants');

// @desc    Get dashboard stats
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    let salesQuery = {};
    let stockQuery = {};

    // Apply role-based filters
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      salesQuery.soldBy = req.user._id;
      stockQuery.currentHolderId = req.user._id;
    } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
      const teamMembers = await User.find({ teamLeaderId: req.user._id }).select('_id');
      const teamMemberIds = teamMembers.map(m => m._id);
      salesQuery.soldBy = { $in: [req.user._id, ...teamMemberIds] };
      stockQuery.currentHolderId = { $in: [req.user._id, ...teamMemberIds] };
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      salesQuery.region = req.user.region;
      const regionUsers = await User.find({ region: req.user.region }).select('_id');
      stockQuery.currentHolderId = { $in: regionUsers.map(u => u._id) };
    }

    // Today's sales
    const todaySales = await Sale.aggregate([
      { $match: { ...salesQuery, createdAt: { $gte: today } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$saleAmount' } } }
    ]);

    // This month's sales
    const monthSales = await Sale.aggregate([
      { $match: { ...salesQuery, createdAt: { $gte: thisMonth } } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$saleAmount' } } }
    ]);

    // Stock counts
    const totalStock = await IMEI.countDocuments({ status: IMEI_STATUS.IN_STOCK });
    const allocatedStock = await IMEI.countDocuments({ 
      ...stockQuery, 
      status: IMEI_STATUS.ALLOCATED 
    });

    // Pending commissions
    let commissionQuery = {};
    if (req.user.role !== USER_ROLES.ADMIN) {
      commissionQuery.userId = req.user._id;
    }
    const pendingCommissions = await Commission.aggregate([
      { $match: { ...commissionQuery, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // User counts (for admin/RM)
    let userCounts = {};
    if (req.user.role === USER_ROLES.ADMIN) {
      userCounts = {
        totalUsers: await User.countDocuments({ isActive: true }),
        regionalManagers: await User.countDocuments({ role: USER_ROLES.REGIONAL_MANAGER, isActive: true }),
        teamLeaders: await User.countDocuments({ role: USER_ROLES.TEAM_LEADER, isActive: true }),
        fieldOfficers: await User.countDocuments({ role: USER_ROLES.FIELD_OFFICER, isActive: true })
      };
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      userCounts = {
        teamLeaders: await User.countDocuments({ 
          role: USER_ROLES.TEAM_LEADER, 
          region: req.user.region, 
          isActive: true 
        }),
        fieldOfficers: await User.countDocuments({ 
          role: USER_ROLES.FIELD_OFFICER, 
          region: req.user.region, 
          isActive: true 
        })
      };
    }

    res.json({
      success: true,
      data: {
        sales: {
          today: {
            count: todaySales[0]?.count || 0,
            revenue: todaySales[0]?.revenue || 0
          },
          month: {
            count: monthSales[0]?.count || 0,
            revenue: monthSales[0]?.revenue || 0
          }
        },
        stock: {
          total: totalStock,
          allocated: allocatedStock
        },
        commissions: {
          pending: pendingCommissions[0]?.total || 0,
          pendingCount: pendingCommissions[0]?.count || 0
        },
        users: userCounts
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales chart data
// @route   GET /api/dashboard/sales-chart
// @access  Private
exports.getSalesChartData = async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;

    let startDate;
    let groupBy;

    switch (period) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    let matchQuery = { createdAt: { $gte: startDate } };

    // Apply role-based filters
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      matchQuery.soldBy = req.user._id;
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = req.user.region;
    }

    const chartData = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 },
          revenue: { $sum: '$saleAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: chartData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top performers
// @route   GET /api/dashboard/top-performers
// @access  Private (Admin, RM)
exports.getTopPerformers = async (req, res, next) => {
  try {
    const { period = 'month', limit = 10 } = req.query;

    let startDate = new Date();
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    let matchQuery = { createdAt: { $gte: startDate } };

    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = req.user.region;
    }

    const topPerformers = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$soldBy',
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          name: '$user.name',
          role: '$user.role',
          region: '$user.region',
          salesCount: 1,
          totalRevenue: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: topPerformers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get regional stats
// @route   GET /api/dashboard/regional-stats
// @access  Private (Admin)
exports.getRegionalStats = async (req, res, next) => {
  try {
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const regionalStats = await Sale.aggregate([
      { $match: { createdAt: { $gte: thisMonth } } },
      {
        $group: {
          _id: '$region',
          salesCount: { $sum: 1 },
          revenue: { $sum: '$saleAmount' }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    res.json({
      success: true,
      data: regionalStats
    });
  } catch (error) {
    next(error);
  }
};
