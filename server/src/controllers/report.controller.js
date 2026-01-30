const Sale = require('../models/Sale');
const Commission = require('../models/Commission');
const IMEI = require('../models/IMEI');
const User = require('../models/User');
const StockAllocation = require('../models/StockAllocation');
const { USER_ROLES } = require('../config/constants');

// @desc    Get sales report
// @route   GET /api/reports/sales
// @access  Private
exports.getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, region, groupBy = 'day' } = req.query;

    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    if (region) {
      matchQuery.region = region;
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = req.user.region;
    } else if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      matchQuery.soldBy = req.user._id;
    }

    let groupByFormat;
    switch (groupBy) {
      case 'day':
        groupByFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
      case 'week':
        groupByFormat = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
        break;
      case 'month':
        groupByFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      default:
        groupByFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    }

    const report = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupByFormat,
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSale: { $avg: '$saleAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Summary
    const summary = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSale: { $avg: '$saleAmount' },
          minSale: { $min: '$saleAmount' },
          maxSale: { $max: '$saleAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        report,
        summary: summary[0] || {}
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get commission report
// @route   GET /api/reports/commissions
// @access  Private
exports.getCommissionReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status, role } = req.query;

    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    if (status) {
      matchQuery.status = status;
    }

    if (role) {
      matchQuery.role = role;
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      matchQuery.userId = req.user._id;
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      const regionUsers = await User.find({ region: req.user.region }).select('_id');
      matchQuery.userId = { $in: regionUsers.map(u => u._id) };
    }

    // By status
    const byStatus = await Commission.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    // By role
    const byRole = await Commission.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);

    // By user (top earners)
    const byUser = await Commission.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
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
          count: 1,
          total: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byStatus,
        byRole,
        topEarners: byUser
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get inventory report
// @route   GET /api/reports/inventory
// @access  Private (Admin, RM)
exports.getInventoryReport = async (req, res, next) => {
  try {
    // By status
    const byStatus = await IMEI.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // By product
    const byProduct = await IMEI.aggregate([
      {
        $group: {
          _id: '$productId',
          total: { $sum: 1 },
          inStock: {
            $sum: { $cond: [{ $eq: ['$status', 'in_stock'] }, 1, 0] }
          },
          allocated: {
            $sum: { $cond: [{ $eq: ['$status', 'allocated'] }, 1, 0] }
          },
          sold: {
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          category: '$product.category',
          total: 1,
          inStock: 1,
          allocated: 1,
          sold: 1
        }
      },
      { $sort: { total: -1 } }
    ]);

    // By holder (who has stock)
    const byHolder = await IMEI.aggregate([
      { $match: { status: 'allocated', currentHolderId: { $ne: null } } },
      {
        $group: {
          _id: '$currentHolderId',
          count: { $sum: 1 }
        }
      },
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
          stockCount: '$count'
        }
      },
      { $sort: { stockCount: -1 } }
    ]);

    // Calculate summary
    const totalIMEIs = await IMEI.countDocuments();
    const summary = {
      totalDevices: totalIMEIs,
      inStock: byStatus.find(s => s._id === 'in_stock')?.count || 0,
      allocated: byStatus.find(s => s._id === 'allocated')?.count || 0,
      sold: byStatus.find(s => s._id === 'sold')?.count || 0,
      locked: byStatus.find(s => s._id === 'locked')?.count || 0
    };

    // Get low stock items (threshold 10 units)
    const lowStock = byProduct.filter(p => p.inStock < 10);

    res.json({
      success: true,
      data: {
        summary,
        byStatus,
        byProduct,
        byHolder,
        lowStock
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get allocation report
// @route   GET /api/reports/allocations
// @access  Private
exports.getAllocationReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      const regionUsers = await User.find({ region: req.user.region }).select('_id');
      const regionUserIds = regionUsers.map(u => u._id);
      matchQuery.$or = [
        { fromUserId: { $in: regionUserIds } },
        { toUserId: { $in: regionUserIds } }
      ];
    }

    // By level
    const byLevel = await StockAllocation.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { from: '$fromLevel', to: '$toLevel' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Daily allocations
    const daily = await StockAllocation.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        byLevel,
        daily
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get performance report
// @route   GET /api/reports/performance
// @access  Private (Admin, RM)
exports.getPerformanceReport = async (req, res, next) => {
  try {
    const { startDate, endDate, region } = req.query;

    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    if (region || req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = region || req.user.region;
    }

    // Sales by user
    const userPerformance = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$soldBy',
          salesCount: { $sum: 1 },
          revenue: { $sum: '$saleAmount' }
        }
      },
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
          revenue: 1,
          avgSale: { $divide: ['$revenue', '$salesCount'] }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Sales by region
    const regionPerformance = await Sale.aggregate([
      { $match: matchQuery },
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
      data: {
        userPerformance,
        regionPerformance
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export sales report to Excel
// @route   GET /api/reports/sales/export
// @access  Private
exports.exportSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, region, format = 'excel' } = req.query;

    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    if (region) {
      matchQuery.region = region;
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = req.user.region;
    } else if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      matchQuery.soldBy = req.user._id;
    }

    // Get sales data
    const sales = await Sale.find(matchQuery)
      .populate('productId', 'name category')
      .populate('soldBy', 'name email foCode role')
      .sort({ createdAt: -1 });

    // Get summary
    const summary = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSale: { $avg: '$saleAmount' }
        }
      }
    ]);

    // Generate CSV format
    if (format === 'csv') {
      let csv = 'Date,Product,Seller,Payment Method,Amount,Client Name,Client Phone\n';
      
      sales.forEach(sale => {
        const date = new Date(sale.createdAt).toLocaleDateString();
        const product = sale.productId?.name || 'Unknown';
        const seller = sale.soldBy?.name || 'Unknown';
        const method = sale.paymentMethod || 'N/A';
        const amount = sale.saleAmount || 0;
        const clientName = sale.customerName || '';
        const clientPhone = sale.customerPhone || '';
        
        csv += `"${date}","${product}","${seller}","${method}",${amount},"${clientName}","${clientPhone}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.csv');
      res.send(csv);
    } else {
      // Generate JSON format (can be used by client-side Excel generation)
      const reportData = {
        generatedAt: new Date().toISOString(),
        period: {
          startDate,
          endDate
        },
        summary: summary[0] || {},
        sales: sales.map(sale => ({
          date: new Date(sale.createdAt).toLocaleDateString(),
          time: new Date(sale.createdAt).toLocaleTimeString(),
          product: sale.productId?.name || 'Unknown',
          category: sale.productId?.category || 'N/A',
          seller: sale.soldBy?.name || 'Unknown',
          foCode: sale.soldBy?.foCode || 'N/A',
          paymentMethod: sale.paymentMethod,
          paymentReference: sale.paymentReference || 'N/A',
          amount: sale.saleAmount,
          clientName: sale.customerName || '',
          clientPhone: sale.customerPhone || '',
          clientId: sale.customerIdNumber || '',
          imei: sale.imei || 'N/A'
        }))
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.json');
      res.send(reportData);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get comprehensive report with all metrics for all regions
// @route   GET /api/reports/comprehensive
// @access  Private (Admin, RM)
exports.getComprehensiveReport = async (req, res, next) => {
  try {
    const { startDate, endDate, regions } = req.query;
    const regionList = regions ? regions.split(',') : [];

    let matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Get all regions or filter by specified regions
    let regionsToProcess = regionList;
    if (regionsToProcess.length === 0) {
      // Get distinct regions from sales
      const distinctRegions = await Sale.distinct('region', matchQuery);
      regionsToProcess = distinctRegions.filter(r => r);
    }

    // Process each region
    const regionReports = await Promise.all(
      regionsToProcess.map(async (region) => {
        const regionMatchQuery = { ...matchQuery, region };
        
        // Sales data
        const sales = await Sale.find(regionMatchQuery)
          .populate('productId', 'name category')
          .populate('soldBy', 'name foCode role region')
          .lean();

        // Commissions for this region
        const regionUserIds = (await User.find({ region }).select('_id')).map(u => u._id);
        const commissions = await Commission.find({
          userId: { $in: regionUserIds },
          createdAt: matchQuery.createdAt
        }).lean();

        // Calculate metrics
        const totalRevenue = sales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
        const totalSales = sales.length;
        const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);

        // Top products
        const productSales = {};
        sales.forEach(sale => {
          if (!productSales[sale.productId?._id]) {
            productSales[sale.productId?._id] = {
              name: sale.productId?.name || 'Unknown',
              sales: 0,
            };
          }
          productSales[sale.productId?._id].sales += sale.saleAmount || 0;
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5)
          .map(p => ({ name: p.name, value: p.sales }));

        // FO Performance
        const foPerformance = {};
        sales.forEach(sale => {
          const foId = sale.soldBy?._id;
          const foCode = sale.soldBy?.foCode || 'Unknown';
          const foName = sale.soldBy?.name || 'Unknown';
          
          if (foId) {
            if (!foPerformance[foId]) {
              foPerformance[foId] = {
                foCode,
                name: foName,
                sales: 0,
                commissions: 0,
              };
            }
            foPerformance[foId].sales += sale.saleAmount || 0;
          }
        });

        commissions.forEach(c => {
          if (foPerformance[c.userId]) {
            foPerformance[c.userId].commissions += c.amount || 0;
          }
        });

        const foData = Object.values(foPerformance)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5);

        // Inventory for region
        const regionInventory = await IMEI.aggregate([
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: '_id',
              as: 'product'
            }
          },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);

        const inventorySummary = {
          inStock: regionInventory.find(i => i._id === 'IN_STOCK')?.count || 0,
          allocated: regionInventory.find(i => i._id === 'ALLOCATED')?.count || 0,
          sold: regionInventory.find(i => i._id === 'SOLD')?.count || 0,
          locked: regionInventory.find(i => i._id === 'LOCKED')?.count || 0,
        };

        // Detailed sales data for Excel
        const detailedSales = sales.map(sale => ({
          date: new Date(sale.createdAt).toLocaleDateString('en-KE'),
          foName: sale.soldBy?.name || 'Unknown',
          foCode: sale.soldBy?.foCode || 'N/A',
          phoneModel: sale.productId?.name || 'Unknown',
          imei: sale.imei || 'N/A',
          qty: sale.quantity || 1,
          sellingPrice: sale.saleAmount || 0,
          commission: (commissions.find(c => c.saleId == sale._id)?.amount || 0),
          paymentMode: sale.paymentMethod === 'mpesa' ? 'M-PESA' : 'Cash',
        }));

        return {
          region,
          summary: {
            totalRevenue,
            totalSales,
            totalCommissions,
            avgSale: totalSales > 0 ? totalRevenue / totalSales : 0,
          },
          topProducts,
          foData,
          inventory: inventorySummary,
          detailedSales,
        };
      })
    );

    // Overall statistics
    const allSales = await Sale.find(matchQuery).lean();
    const totalOverallRevenue = allSales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
    const totalOverallSales = allSales.length;

    const allCommissions = await Commission.find({
      createdAt: matchQuery.createdAt
    }).lean();
    const totalOverallCommissions = allCommissions.reduce((sum, c) => sum + (c.amount || 0), 0);

    // Company performance (aggregate all sales by month/week)
    const companyPerformance = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: 1 },
          revenue: { $sum: '$saleAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        period: {
          startDate,
          endDate
        },
        summary: {
          totalRevenue: totalOverallRevenue,
          totalSales: totalOverallSales,
          totalCommissions: totalOverallCommissions,
          avgSale: totalOverallSales > 0 ? totalOverallRevenue / totalOverallSales : 0,
          regionsCount: regionReports.length,
        },
        companyPerformance,
        regionReports,
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get active field officers
// @route   GET /api/reports/active-fos
// @access  Private
exports.getActiveFOs = async (req, res, next) => {
  try {
    const { startDate, endDate, region } = req.query;

    let salesMatchQuery = {};

    if (startDate || endDate) {
      salesMatchQuery.createdAt = {};
      if (startDate) salesMatchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) salesMatchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply region filter
    let userQuery = { role: USER_ROLES.FIELD_OFFICER };
    
    if (region) {
      userQuery.region = region;
      salesMatchQuery.region = region;
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      userQuery.region = req.user.region;
      salesMatchQuery.region = req.user.region;
    }

    // Get FOs who made sales in the date range
    const activeFOsInPeriod = await Sale.aggregate([
      { $match: salesMatchQuery },
      {
        $group: {
          _id: '$soldBy',
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' }
        }
      },
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
        $match: {
          'user.role': USER_ROLES.FIELD_OFFICER
        }
      },
      {
        $project: {
          userId: '$_id',
          name: '$user.name',
          foCode: '$user.foCode',
          region: '$user.region',
          salesCount: 1,
          totalRevenue: 1
        }
      },
      { $sort: { salesCount: -1 } }
    ]);

    // Get total FOs in system
    const totalFOs = await User.countDocuments(userQuery);

    // Get active FOs (those with sales)
    const activeFOsCount = activeFOsInPeriod.length;

    res.json({
      success: true,
      data: {
        activeFOs: activeFOsInPeriod,
        activeFOsCount,
        totalFOs,
        inactiveCount: Math.max(0, totalFOs - activeFOsCount)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top selling products
// @route   GET /api/reports/top-products
// @access  Private
exports.getTopProducts = async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 5 } = req.query;

    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = req.user.region;
    } else if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      matchQuery.soldBy = req.user._id;
    }

    // Top selling products
    const topProducts = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productName' },
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgPrice: { $avg: '$saleAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) || 5 },
      {
        $project: {
          _id: 1,
          productName: 1,
          salesCount: 1,
          totalRevenue: 1,
          avgPrice: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        products: topProducts,
        count: topProducts.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company performance (Watu/Mogo/Onfon)
// @route   GET /api/reports/company-performance
// @access  Private
exports.getCompanyPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let matchQuery = {};

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = req.user.region;
    } else if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      matchQuery.soldBy = req.user._id;
    }

    // Company performance breakdown
    const companyPerformance = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$source',
          salesCount: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSale: { $avg: '$saleAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Calculate percentages
    const totalRevenue = companyPerformance.reduce((sum, c) => sum + c.totalRevenue, 0);
    
    const data = companyPerformance.map(company => ({
      company: company._id,
      name: company._id.charAt(0).toUpperCase() + company._id.slice(1),
      salesCount: company.salesCount,
      totalRevenue: company.totalRevenue,
      avgSale: company.avgSale,
      percentage: totalRevenue > 0 ? Math.round((company.totalRevenue / totalRevenue) * 100) : 0
    }));

    res.json({
      success: true,
      data: {
        companies: data,
        summary: {
          totalRevenue,
          totalSales: companyPerformance.reduce((sum, c) => sum + c.salesCount, 0)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
