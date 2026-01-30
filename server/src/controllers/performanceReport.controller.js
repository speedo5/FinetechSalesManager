/**
 * =============================================================================
 * PERFORMANCE REPORT CONTROLLER
 * =============================================================================
 * 
 * Comprehensive reporting endpoints for detailed system performance analysis.
 * Generates detailed metrics by region, product, field officer, and payment method.
 * 
 * Endpoints:
 * - GET /api/reports/performance/overview - Overall system performance
 * - GET /api/reports/performance/by-region - Detailed metrics per region
 * - GET /api/reports/performance/by-product - Product performance analysis
 * - GET /api/reports/performance/by-fo - Field officer performance metrics
 * - GET /api/reports/performance/payment-methods - Payment method breakdown
 * 
 * =============================================================================
 */

const Sale = require('../models/Sale');
const Commission = require('../models/Commission');
const User = require('../models/User');
const Product = require('../models/Product');
const IMEI = require('../models/IMEI');

// @desc    Get overall performance overview
// @route   GET /api/reports/performance/overview
// @access  Private (Admin, RM)
exports.getPerformanceOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === 'regional_manager') {
      matchQuery.region = req.user.region;
    } else if (req.user.role === 'field_officer') {
      matchQuery.soldBy = req.user._id;
    }

    // Sales metrics
    const salesMetrics = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSaleValue: { $avg: '$saleAmount' },
          minSale: { $min: '$saleAmount' },
          maxSale: { $max: '$saleAmount' }
        }
      }
    ]);

    // Commission metrics
    const commissionMetrics = await Commission.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Active FOs
    const activeFOs = await User.countDocuments({
      role: 'field_officer',
      ...(req.user.role === 'regional_manager' && { region: req.user.region })
    });

    // Inventory metrics
    const inventoryMetrics = await IMEI.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        salesMetrics: salesMetrics[0] || {},
        commissionMetrics,
        activeFOs,
        inventoryMetrics
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get performance metrics by region
// @route   GET /api/reports/performance/by-region
// @access  Private (Admin, RM)
exports.getPerformanceByRegion = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === 'regional_manager') {
      matchQuery.region = req.user.region;
    } else if (req.user.role === 'field_officer') {
      matchQuery.soldBy = req.user._id;
    }

    const regionMetrics = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$region',
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSaleValue: { $avg: '$saleAmount' },
          uniqueFOs: { $addToSet: '$soldBy' }
        }
      },
      {
        $addFields: {
          foCount: { $size: '$uniqueFOs' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      data: regionMetrics
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get performance metrics by product
// @route   GET /api/reports/performance/by-product
// @access  Private (Admin, RM)
exports.getPerformanceByProduct = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === 'regional_manager') {
      matchQuery.region = req.user.region;
    } else if (req.user.role === 'field_officer') {
      matchQuery.soldBy = req.user._id;
    }

    const productMetrics = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productName' },
          unitsSold: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgPrice: { $avg: '$saleAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: productMetrics
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get field officer performance metrics
// @route   GET /api/reports/performance/by-fo
// @access  Private (Admin, RM)
exports.getPerformanceByFO = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === 'regional_manager') {
      matchQuery.region = req.user.region;
    } else if (req.user.role === 'field_officer') {
      matchQuery.soldBy = req.user._id;
    }

    const foMetrics = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$soldBy',
          foCode: { $first: '$foCode' },
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSaleValue: { $avg: '$saleAmount' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'foDetails'
        }
      },
      { $unwind: { path: '$foDetails', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          foId: '$_id',
          foCode: 1,
          foName: '$foDetails.name',
          region: '$foDetails.region',
          salesCount: 1,
          totalRevenue: 1,
          avgSaleValue: 1
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Add commission data
    const foCommissions = await Commission.aggregate([
      { $match: { ...matchQuery, userId: { $in: foMetrics.map(f => f.foId) } } },
      {
        $group: {
          _id: '$userId',
          totalCommissions: { $sum: '$amount' },
          paidCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
          },
          pendingCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
          }
        }
      }
    ]);

    // Merge commission data
    const result = foMetrics.map(fo => {
      const commission = foCommissions.find(c => c._id.toString() === fo.foId.toString());
      return {
        ...fo,
        commissions: {
          total: commission?.totalCommissions || 0,
          paid: commission?.paidCommissions || 0,
          pending: commission?.pendingCommissions || 0
        }
      };
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment method breakdown
// @route   GET /api/reports/performance/payment-methods
// @access  Private (Admin, RM)
exports.getPaymentMethodBreakdown = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === 'regional_manager') {
      matchQuery.region = req.user.region;
    } else if (req.user.role === 'field_officer') {
      matchQuery.soldBy = req.user._id;
    }

    const paymentBreakdown = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$saleAmount' },
          avgValue: { $avg: '$saleAmount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({
      success: true,
      data: paymentBreakdown
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get comprehensive performance report
// @route   GET /api/reports/performance/comprehensive
// @access  Private (Admin, RM)
exports.getComprehensiveReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === 'regional_manager') {
      matchQuery.region = req.user.region;
    } else if (req.user.role === 'field_officer') {
      matchQuery.soldBy = req.user._id;
    }

    // Fetch all metrics in parallel
    const [overview, byRegion, byProduct, byFO, paymentMethods] = await Promise.all([
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalRevenue: { $sum: '$saleAmount' },
            avgSaleValue: { $avg: '$saleAmount' }
          }
        }
      ]),
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$region',
            totalRevenue: { $sum: '$saleAmount' },
            salesCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } }
      ]),
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$productId',
            productName: { $first: '$productName' },
            unitsSold: { $sum: 1 },
            totalRevenue: { $sum: '$saleAmount' }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ]),
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$soldBy',
            foCode: { $first: '$foCode' },
            salesCount: { $sum: 1 },
            totalRevenue: { $sum: '$saleAmount' }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ]),
      Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$paymentMethod',
            count: { $sum: 1 },
            total: { $sum: '$saleAmount' }
          }
        },
        { $sort: { total: -1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        overview: overview[0] || {},
        byRegion,
        byProduct,
        byFO,
        paymentMethods
      }
    });
  } catch (error) {
    next(error);
  }
};
