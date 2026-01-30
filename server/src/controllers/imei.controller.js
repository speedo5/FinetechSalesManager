const IMEI = require('../models/IMEI');
const Product = require('../models/Product');
const { USER_ROLES, IMEI_STATUS } = require('../config/constants');

// @desc    Get all IMEIs
// @route   GET /api/imei
// @access  Private
exports.getIMEIs = async (req, res, next) => {
  try {
    const { status, productId, search, currentHolderId, page = 1, limit = 50 } = req.query;

    let query = {};

    // Normalize status to internal enum values (case-insensitive)
    if (status) {
      const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : status;
      if (Object.values(IMEI_STATUS).includes(normalizedStatus)) {
        query.status = normalizedStatus;
        console.log('IMEI Query - normalized status:', normalizedStatus);
      } else {
        // If unrecognized, keep original value but log a warning
        query.status = status;
        console.log('IMEI Query - unrecognized status provided, using as-is:', status);
      }
    }

    if (productId) {
      query.productId = productId;
    }

    if (search) {
      query.imei = { $regex: search, $options: 'i' };
    }

    // Debug logging
    console.log('IMEI Query - currentHolderId param:', currentHolderId, 'type:', typeof currentHolderId);
    // Preserve previous status log for backwards traceability
    console.log('IMEI Query - status param (raw):', status);

    // If currentHolderId is explicitly provided, use it
    if (currentHolderId) {
      try {
        const mongoose = require('mongoose');
        // Try to convert to ObjectId if it looks like one
        query.currentHolderId = mongoose.Types.ObjectId.isValid(currentHolderId) 
          ? mongoose.Types.ObjectId(currentHolderId)
          : currentHolderId;
        console.log('IMEI Query - Converted currentHolderId:', query.currentHolderId);
      } catch (e) {
        query.currentHolderId = currentHolderId;
        console.log('IMEI Query - Conversion error, using as-is:', currentHolderId);
      }
    } else {
      // Apply role-based filters
      if (req.user.role === USER_ROLES.FIELD_OFFICER) {
        // Field officer sees only their allocated inventory
        query.currentHolderId = req.user._id;
      } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
        // Team leader sees inventory allocated to them AND their team members
        const User = require('../models/User');
        const teamMembers = await User.find({ teamLeaderId: req.user._id }).select('_id');
        const teamMemberIds = teamMembers.map(m => m._id);
        query.currentHolderId = { $in: [req.user._id, ...teamMemberIds] };
      }
      // Regional Manager and Admin see all (no filter)
    }

    const skip = (page - 1) * limit;

    console.log('\n=== IMEI QUERY DEBUG ===');
    console.log('Final Query Object:', JSON.stringify(query, (key, value) => {
      if (value && typeof value === 'object' && value.constructor.name === 'ObjectId') {
        return value.toString();
      }
      return value;
    }, 2));

    const imeis = await IMEI.find(query)
      .populate('productId', 'name category price brand')
      .populate('currentHolderId', 'name email role')
      .populate('registeredBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await IMEI.countDocuments(query);

    console.log('IMEI Query result - Found:', imeis.length, 'items, Total matching query:', total);
    console.log('======================\n');

    // Map response to include sellingPrice (from price field or product price)
    const formattedImeis = imeis.map(imei => {
      const imeiObj = imei.toObject();
      imeiObj.sellingPrice = imei.price || (imei.productId?.price || 0);
      return imeiObj;
    });

    // Prevent caching for dynamic inventory queries
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({
      success: true,
      count: formattedImeis.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: formattedImeis
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single IMEI
// @route   GET /api/imei/:id
// @access  Private
exports.getIMEI = async (req, res, next) => {
  try {
    const imei = await IMEI.findById(req.params.id)
      .populate('productId')
      .populate('currentHolderId', 'name email role')
      .populate('registeredBy', 'name');

    if (!imei) {
      return res.status(404).json({
        success: false,
        message: 'IMEI not found'
      });
    }

    const imeiObj = imei.toObject();
    imeiObj.sellingPrice = imei.price || (imei.productId?.price || 0);

    res.json({
      success: true,
      data: imeiObj
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Register new IMEI
// @route   POST /api/imei
// @access  Private (Admin)
exports.registerIMEI = async (req, res, next) => {
  try {
    const { imei, imei2, productId, price, commissionConfig, notes } = req.body;

    // Check if IMEI already exists
    const existingIMEI = await IMEI.findOne({ imei });
    if (existingIMEI) {
      return res.status(400).json({
        success: false,
        message: 'IMEI already registered'
      });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const newIMEI = await IMEI.create({
      imei,
      imei2,
      productId,
      price,
      registeredBy: req.user._id,
      commissionConfig: commissionConfig || product.commissionConfig,
      notes
    });

    await newIMEI.populate('productId', 'name category price');

    const imeiObj = newIMEI.toObject();
    imeiObj.sellingPrice = newIMEI.price || (newIMEI.productId?.price || 0);

    res.status(201).json({
      success: true,
      data: imeiObj
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk register IMEIs
// @route   POST /api/imei/bulk
// @access  Private (Admin)
exports.bulkRegisterIMEI = async (req, res, next) => {
  try {
    const { imeis } = req.body; // Array of IMEI objects

    const results = {
      success: [],
      failed: []
    };

    for (const imeiData of imeis) {
      try {
        // Check if IMEI already exists
        const existing = await IMEI.findOne({ imei: imeiData.imei });
        if (existing) {
          results.failed.push({
            imei: imeiData.imei,
            reason: 'IMEI already exists'
          });
          continue;
        }

        // Get product
        const product = await Product.findById(imeiData.productId);
        if (!product) {
          results.failed.push({
            imei: imeiData.imei,
            reason: 'Product not found'
          });
          continue;
        }

        const newIMEI = await IMEI.create({
          ...imeiData,
          registeredBy: req.user._id,
          commissionConfig: imeiData.commissionConfig || product.commissionConfig
        });

        results.success.push(newIMEI.imei);
      } catch (err) {
        results.failed.push({
          imei: imeiData.imei,
          reason: err.message
        });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      message: `${results.success.length} IMEIs registered, ${results.failed.length} failed`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update IMEI
// @route   PUT /api/imei/:id
// @access  Private (Admin)
exports.updateIMEI = async (req, res, next) => {
  try {
    const imei = await IMEI.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('productId', 'name category price');

    if (!imei) {
      return res.status(404).json({
        success: false,
        message: 'IMEI not found'
      });
    }

    const imeiObj = imei.toObject();
    imeiObj.sellingPrice = imei.price || (imei.productId?.price || 0);

    res.json({
      success: true,
      data: imeiObj
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get my stock (for Field Officers)
// @route   GET /api/imei/my-stock
// @access  Private
exports.getMyStock = async (req, res, next) => {
  try {
    const imeis = await IMEI.find({
      currentHolderId: req.user._id,
      status: IMEI_STATUS.ALLOCATED
    })
      .populate('productId', 'name category price brand')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: imeis.length,
      data: imeis
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search IMEI by number
// @route   GET /api/imei/search/:imeiNumber
// @access  Private
exports.searchIMEI = async (req, res, next) => {
  try {
    const imei = await IMEI.findOne({ imei: req.params.imeiNumber })
      .populate('productId')
      .populate('currentHolderId', 'name email role')
      .populate('saleId');

    if (!imei) {
      return res.status(404).json({
        success: false,
        message: 'IMEI not found'
      });
    }

    res.json({
      success: true,
      data: imei
    });
  } catch (error) {
    next(error);
  }
};
