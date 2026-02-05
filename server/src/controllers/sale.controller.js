const Sale = require('../models/Sale');
const IMEI = require('../models/IMEI');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { USER_ROLES, IMEI_STATUS } = require('../config/constants');

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res, next) => {
  try {
    const { startDate, endDate, region, soldBy, page = 1, limit = 50 } = req.query;

    let query = {};

    // Date filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (region) {
      query.region = region;
    }

    if (soldBy) {
      query.soldBy = soldBy;
    }

    // Apply role-based filters
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      query.soldBy = req.user._id;
    } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
      const teamMembers = await User.find({ teamLeaderId: req.user._id }).select('_id');
      const teamMemberIds = teamMembers.map(m => m._id);
      query.soldBy = { $in: [req.user._id, ...teamMemberIds] };
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      query.region = req.user.region;
    }

    const skip = (page - 1) * limit;

    const sales = await Sale.find(query)
      .populate('productId', 'name category')
      .populate('imeiId', 'imei')
      .populate('soldBy', 'name email role foCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Sale.countDocuments(query);

    // Calculate total sales amount
    const totalAmount = await Sale.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$saleAmount' } } }
    ]);

    // Transform sales data to include frontend-friendly field names
    const transformedSales = sales.map(sale => {
      const saleObj = sale.toObject();
      return {
        ...saleObj,
        id: saleObj._id.toString(),
        productName: saleObj.productId?.name || 'Unknown Product',
        productId: saleObj.productId?._id?.toString() || '',
        etrReceiptNo: saleObj.receiptNumber,
        sellerName: saleObj.soldBy?.name || 'Unknown',
        sellerEmail: saleObj.soldBy?.email || '',
        foCode: saleObj.soldBy?.foCode || '',
        clientName: saleObj.customerName || '',
        clientPhone: saleObj.customerPhone || '',
        clientIdNumber: saleObj.customerIdNumber || '',
        source: saleObj.source || '',
        createdBy: saleObj.soldBy?._id?.toString() || '',
      };
    });

    res.json({
      success: true,
      count: sales.length,
      total,
      totalAmount: totalAmount[0]?.total || 0,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: transformedSales
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
exports.getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('productId')
      .populate('imeiId', 'imei')
      .populate('soldBy', 'name email role foCode');

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Transform sale data
    const saleObj = sale.toObject();
    const transformedSale = {
      ...saleObj,
      id: saleObj._id.toString(),
      productName: saleObj.productId?.name || 'Unknown Product',
      productId: saleObj.productId?._id?.toString() || '',
      etrReceiptNo: saleObj.receiptNumber,
      sellerName: saleObj.soldBy?.name || 'Unknown',
      sellerEmail: saleObj.soldBy?.email || '',
      foCode: saleObj.soldBy?.foCode || '',
      clientName: saleObj.customerName || '',
      clientPhone: saleObj.customerPhone || '',
      clientIdNumber: saleObj.customerIdNumber || '',
      source: saleObj.source || '',
      createdBy: saleObj.soldBy?._id?.toString() || '',
    };

    res.json({
      success: true,
      data: transformedSale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create sale
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res, next) => {
  try {
    const { imeiId, productId, quantity, paymentMethod, paymentReference, customerName, customerPhone, customerEmail, customerIdNumber, source, notes } = req.body;

    // Custom validation: either imeiId (for phones) OR productId+quantity (for accessories) must be provided
    if (!imeiId && !productId) {
      return res.status(400).json({
        success: false,
        errors: [{ field: 'imeiId', message: 'Either IMEI ID or Product ID is required' }]
      });
    }

    // Normalize payment method to lowercase for database
    const { PAYMENT_METHODS } = require('../config/constants');
    const lowerPaymentMethod = paymentMethod?.toLowerCase?.() || '';
    
    // Map common payment method names to valid enum values
    const paymentMethodMap = {
      'cash': PAYMENT_METHODS.CASH,
      'mpesa': PAYMENT_METHODS.MPESA,
      'm-pesa': PAYMENT_METHODS.MPESA,
      'bank transfer': PAYMENT_METHODS.CASH,
      'credit': PAYMENT_METHODS.CASH
    };
    
    const normalizedPaymentMethod = paymentMethodMap[lowerPaymentMethod] || PAYMENT_METHODS.CASH;

    // Generate receipt number
    const count = await Sale.countDocuments({});
    const receiptNumber = `RCP-${String(2000 + count + 1).padStart(6, '0')}`;

    // PHONE SALE (with IMEI)
    if (imeiId) {
      // Get IMEI and verify it can be sold
      const imei = await IMEI.findById(imeiId).populate('productId');

      if (!imei) {
        return res.status(404).json({
          success: false,
          message: 'IMEI not found'
        });
      }

      if (imei.status === IMEI_STATUS.SOLD) {
        return res.status(400).json({
          success: false,
          message: 'This device has already been sold'
        });
      }

      // Verify stock ownership based on user role
      if (req.user.role === USER_ROLES.ADMIN) {
        // Admin can sell any device in any region
      } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
        // Regional manager can sell devices in their region
        // If device has region set, it must match. If not set, allow sale and set it
        if (imei.region && imei.region !== req.user.region) {
          return res.status(403).json({
            success: false,
            message: 'You can only sell devices from your region'
          });
        }
        // Set region if not already set
        if (!imei.region) {
          imei.region = req.user.region;
        }
      } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
        // Team leader can sell devices allocated to them OR their team members
        // First check if allocated to the team leader themselves
        const isAllocatedToTL = imei.currentHolderId && imei.currentHolderId.toString() === req.user._id.toString();
        
        if (!isAllocatedToTL) {
          // Check if allocated to a team member (field officer under this team leader)
          const User = require('../models/User');
          const isTeamMember = await User.findOne({
            _id: imei.currentHolderId,
            teamLeaderId: req.user._id
          });
          
          if (!isTeamMember) {
            return res.status(403).json({
              success: false,
              message: 'You can only sell devices allocated to you or your team members'
            });
          }
        }
      } else if (req.user.role === USER_ROLES.FIELD_OFFICER) {
        // Field officer must have device allocated to them
        if (!imei.currentHolderId || imei.currentHolderId.toString() !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'You do not have this device in your stock'
          });
        }
      }

      // Create sale for phone
      const sale = await Sale.create({
        receiptNumber,
        productId: imei.productId._id,
        imeiId: imei._id,
        imei: imei.imei,
        unitPrice: imei.productId.price,
        saleAmount: imei.productId.price,
        paymentMethod: normalizedPaymentMethod,
        paymentReference,
        soldBy: req.user._id,
        customerName,
        customerPhone,
        customerEmail,
        customerIdNumber,
        source: source || 'watu',
        region: req.user.region,
        notes
      });

      // Update IMEI status
      imei.status = IMEI_STATUS.SOLD;
      imei.soldAt = new Date();
      imei.saleId = sale._id;
      await imei.save();

      // Create commissions
      await createCommissions(sale, imei, req.user);

      await sale.populate('productId', 'name category');
      await sale.populate('soldBy', 'name email');

      res.status(201).json({
        success: true,
        data: sale
      });
    }
    // ACCESSORY SALE (without IMEI)
    else if (productId && quantity) {
      const Product = require('../models/Product');
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Calculate sale amount
      const saleAmount = product.price * quantity;

      // Create sale for accessory
      const sale = await Sale.create({
        receiptNumber,
        productId: product._id,
        quantity: quantity || 1,
        unitPrice: product.price,
        saleAmount: saleAmount,
        paymentMethod: normalizedPaymentMethod,
        paymentReference,
        soldBy: req.user._id,
        customerName,
        customerPhone,
        customerEmail,
        customerIdNumber,
        source: source || 'watu',
        region: req.user.region,
        notes
      });

      await sale.populate('productId', 'name category');
      await sale.populate('soldBy', 'name email');

      res.status(201).json({
        success: true,
        data: sale
      });
    }
  } catch (error) {
    next(error);
  }
};

// Helper function to create commissions
async function createCommissions(sale, imei, seller) {
  const commissionConfig = imei.commissionConfig || imei.productId.commissionConfig || {};

  const commissions = [];

  // Determine seller's commission based on their role
  if (seller.role === USER_ROLES.FIELD_OFFICER && commissionConfig.foCommission > 0) {
    // FO selling - gets FO commission
    commissions.push({
      saleId: sale._id,
      userId: seller._id,
      role: USER_ROLES.FIELD_OFFICER,
      amount: commissionConfig.foCommission
    });
  } else if (seller.role === USER_ROLES.TEAM_LEADER && commissionConfig.teamLeaderCommission > 0) {
    // Team Leader selling - gets Team Leader commission
    commissions.push({
      saleId: sale._id,
      userId: seller._id,
      role: USER_ROLES.TEAM_LEADER,
      amount: commissionConfig.teamLeaderCommission
    });
  } else if (seller.role === USER_ROLES.REGIONAL_MANAGER && commissionConfig.regionalManagerCommission > 0) {
    // Regional Manager selling - gets Regional Manager commission
    commissions.push({
      saleId: sale._id,
      userId: seller._id,
      role: USER_ROLES.REGIONAL_MANAGER,
      amount: commissionConfig.regionalManagerCommission
    });
  }

  // Team Leader Commission (if FO is selling and has team leader)
  if (seller.role === USER_ROLES.FIELD_OFFICER && seller.teamLeaderId && commissionConfig.teamLeaderCommission > 0) {
    commissions.push({
      saleId: sale._id,
      userId: seller.teamLeaderId,
      role: USER_ROLES.TEAM_LEADER,
      amount: commissionConfig.teamLeaderCommission
    });
  }

  // Regional Manager Commission
  // Try explicit regionalManagerId first, then fallback to region-based lookup
  let rmId = seller.regionalManagerId;
  
  if (!rmId && seller.region && commissionConfig.regionalManagerCommission > 0) {
    // Lookup RM by region if not explicitly set
    const regionalManager = await User.findOne({
      region: seller.region,
      role: USER_ROLES.REGIONAL_MANAGER
    }).select('_id');
    
    rmId = regionalManager?._id;
  }
  
  // Avoid creating duplicate RM commission when the seller is the regional manager
  if (rmId && commissionConfig.regionalManagerCommission > 0) {
    const rmIdStr = rmId.toString ? rmId.toString() : String(rmId);
    const sellerIdStr = seller._id ? seller._id.toString() : String(seller.id || seller._id);
    if (rmIdStr !== sellerIdStr) {
      commissions.push({
        saleId: sale._id,
        userId: rmId,
        role: USER_ROLES.REGIONAL_MANAGER,
        amount: commissionConfig.regionalManagerCommission
      });
    } else {
      // Seller is already the regional manager; their commission was added above in the seller-role block.
    }
  }

  if (commissions.length > 0) {
    const created = await Commission.insertMany(commissions);
    return created;
  }
  return [];
}

// @desc    Get my sales (for FO)
// @route   GET /api/sales/my-sales
// @access  Private
exports.getMySales = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let query = { soldBy: req.user._id };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query)
      .populate('productId', 'name category')
      .sort({ createdAt: -1 });

    const totalAmount = sales.reduce((sum, sale) => sum + sale.saleAmount, 0);

    res.json({
      success: true,
      count: sales.length,
      totalAmount,
      data: sales
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sales summary
// @route   GET /api/sales/summary
// @access  Private
exports.getSalesSummary = async (req, res, next) => {
  try {
    const { period = 'today' } = req.query;

    let startDate;
    const endDate = new Date();

    switch (period) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }

    let matchQuery = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    // Apply role-based filters
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      matchQuery.soldBy = req.user._id;
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      matchQuery.region = req.user.region;
    }

    const summary = await Sale.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$saleAmount' },
          avgSaleAmount: { $avg: '$saleAmount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: summary[0] || { totalSales: 0, totalRevenue: 0, avgSaleAmount: 0 }
    });
  } catch (error) {
    next(error);
  }
};
