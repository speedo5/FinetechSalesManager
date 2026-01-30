const StockAllocation = require('../models/StockAllocation');
const IMEI = require('../models/IMEI');
const User = require('../models/User');
const { USER_ROLES, IMEI_STATUS, ALLOCATION_STATUS, ALLOCATION_TYPE, ROLE_HIERARCHY } = require('../config/constants');

// @desc    Get all allocations
// @route   GET /api/stock-allocations
// @access  Private
exports.getAllocations = async (req, res, next) => {
  try {
    const { fromUserId, toUserId, status, type, page = 1, limit = 50 } = req.query;

    let query = {};

    if (fromUserId) query.fromUserId = fromUserId;
    if (toUserId) query.toUserId = toUserId;
    if (status) query.status = status;
    if (type) query.type = type;

    // Apply role-based filters
    if (req.user.role === USER_ROLES.FIELD_OFFICER) {
      query.toUserId = req.user._id;
    } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
      query.$or = [
        { fromUserId: req.user._id },
        { toUserId: req.user._id }
      ];
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      const regionUsers = await User.find({ region: req.user.region }).select('_id');
      const regionUserIds = regionUsers.map(u => u._id);
      query.$or = [
        { fromUserId: { $in: regionUserIds } },
        { toUserId: { $in: regionUserIds } }
      ];
    }

    const skip = (page - 1) * limit;

    const allocations = await StockAllocation.find(query)
      .populate('imeiId', 'imei status')
      .populate('productId', 'name category price')
      .populate('fromUserId', 'name email role region')
      .populate('toUserId', 'name email role region')
      .populate('recalledBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await StockAllocation.countDocuments(query);

    res.json({
      success: true,
      count: allocations.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: allocations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Allocate stock
// @route   POST /api/stock-allocations
// @access  Private (Admin, RM, TL)
exports.allocateStock = async (req, res, next) => {
  try {
    const { imeiId, toUserId, notes } = req.body;

    // Get IMEI
    const imei = await IMEI.findById(imeiId).populate('productId');
    if (!imei) {
      return res.status(404).json({
        success: false,
        message: 'IMEI not found'
      });
    }

    // Verify IMEI can be allocated
    if (imei.status === IMEI_STATUS.SOLD) {
      return res.status(400).json({
        success: false,
        message: 'Cannot allocate sold device'
      });
    }

    // Get recipient - try by ID first, then by name if ID fails
    let recipient = null;
    
    // Try to find by ID (for valid MongoDB ObjectIds)
    try {
      recipient = await User.findById(toUserId);
    } catch (e) {
      console.log('toUserId is not a valid ObjectId, trying by name:', toUserId);
    }
    
    // If not found by ID and toUserId looks like a generated ID (user-Name-Index format),
    // extract the name and search by name
    if (!recipient && typeof toUserId === 'string' && toUserId.startsWith('user-')) {
      const namePart = toUserId.replace('user-', '').split('-').slice(0, -1).join(' ');
      console.log('Searching for user by name:', namePart);
      recipient = await User.findOne({ name: namePart });
      console.log('Found recipient by name:', recipient?.name);
    }
    
    // If still not found, try direct name match
    if (!recipient) {
      console.log('Trying direct name lookup for:', toUserId);
      recipient = await User.findOne({ name: toUserId });
    }
    
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: `Recipient user not found (searched for: ${toUserId})`
      });
    }

    console.log('Allocation recipient found:', {
      id: recipient._id,
      name: recipient.name,
      role: recipient.role
    });

    // Validate allocation hierarchy
    const validationResult = validateAllocationHierarchy(req.user, recipient, imei);
    if (!validationResult.valid) {
      return res.status(403).json({
        success: false,
        message: validationResult.message
      });
    }

    // Create allocation record
    const allocation = await StockAllocation.create({
      imeiId: imei._id,
      imei: imei.imei,
      productId: imei.productId._id,
      fromUserId: req.user._id,
      toUserId: recipient._id,
      fromLevel: req.user.role,
      toLevel: recipient.role,
      type: ALLOCATION_TYPE.ALLOCATION,
      status: ALLOCATION_STATUS.COMPLETED,
      notes
    });

    // Update IMEI
    imei.status = IMEI_STATUS.ALLOCATED;
    imei.currentHolderId = recipient._id;
    
    // Set region if allocating to regional manager
    if (recipient.role === USER_ROLES.REGIONAL_MANAGER && recipient.region) {
      imei.region = recipient.region;
    }
    
    await imei.save();

    await allocation.populate('productId', 'name category');
    await allocation.populate('toUserId', 'name email role');

    res.status(201).json({
      success: true,
      data: allocation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk allocate stock
// @route   POST /api/stock-allocations/bulk
// @access  Private (Admin, RM, TL)
exports.bulkAllocateStock = async (req, res, next) => {
  try {
    const { imeiIds, toUserId, notes } = req.body;

    // Get recipient - try by ID first, then by name if ID fails
    let recipient = null;
    
    // Try to find by ID (for valid MongoDB ObjectIds)
    try {
      recipient = await User.findById(toUserId);
    } catch (e) {
      console.log('toUserId is not a valid ObjectId, trying by name:', toUserId);
    }
    
    // If not found by ID and toUserId looks like a generated ID (user-Name-Index format),
    // extract the name and search by name
    if (!recipient && typeof toUserId === 'string' && toUserId.startsWith('user-')) {
      const namePart = toUserId.replace('user-', '').split('-').slice(0, -1).join(' ');
      console.log('Searching for user by name:', namePart);
      recipient = await User.findOne({ name: namePart });
      console.log('Found recipient by name:', recipient?.name);
    }
    
    // If still not found, try direct name match
    if (!recipient) {
      console.log('Trying direct name lookup for:', toUserId);
      recipient = await User.findOne({ name: toUserId });
    }
    
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: `Recipient user not found (searched for: ${toUserId})`
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const imeiId of imeiIds) {
      try {
        const imei = await IMEI.findById(imeiId).populate('productId');
        
        if (!imei) {
          results.failed.push({ imeiId, reason: 'IMEI not found' });
          continue;
        }

        if (imei.status === IMEI_STATUS.SOLD) {
          results.failed.push({ imeiId, reason: 'Already sold' });
          continue;
        }

        const validationResult = validateAllocationHierarchy(req.user, recipient, imei);
        if (!validationResult.valid) {
          results.failed.push({ imeiId, reason: validationResult.message });
          continue;
        }

        // Create allocation
        await StockAllocation.create({
          imeiId: imei._id,
          imei: imei.imei,
          productId: imei.productId._id,
          fromUserId: req.user._id,
          toUserId: recipient._id,
          fromLevel: req.user.role,
          toLevel: recipient.role,
          type: ALLOCATION_TYPE.ALLOCATION,
          status: ALLOCATION_STATUS.COMPLETED,
          notes
        });

        // Update IMEI
        imei.status = IMEI_STATUS.ALLOCATED;
        imei.currentHolderId = recipient._id;
        
        // Set region if allocating to regional manager
        if (recipient.role === USER_ROLES.REGIONAL_MANAGER && recipient.region) {
          imei.region = recipient.region;
        }
        
        await imei.save();

        results.success.push(imei.imei);
      } catch (err) {
        results.failed.push({ imeiId, reason: err.message });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      message: `${results.success.length} allocated, ${results.failed.length} failed`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Recall stock from a user
// @route   POST /api/stock-allocations/recall
// @access  Private (Admin, RM, TL)
exports.recallStock = async (req, res, next) => {
  try {
    const { imeiId, reason } = req.body;

    // Get IMEI
    const imei = await IMEI.findById(imeiId).populate('productId').populate('currentHolderId');
    if (!imei) {
      return res.status(404).json({
        success: false,
        message: 'IMEI not found'
      });
    }

    // Verify IMEI can be recalled (not sold)
    if (imei.status === IMEI_STATUS.SOLD) {
      return res.status(400).json({
        success: false,
        message: 'Cannot recall sold device'
      });
    }

    if (!imei.currentHolderId) {
      return res.status(400).json({
        success: false,
        message: 'Device is not allocated to anyone'
      });
    }

    const currentHolder = imei.currentHolderId;

    // Validate recall hierarchy
    const validationResult = validateRecallHierarchy(req.user, currentHolder);
    if (!validationResult.valid) {
      return res.status(403).json({
        success: false,
        message: validationResult.message
      });
    }

    // Determine new holder (the person recalling or back to stock)
    const newHolderId = req.user.role === USER_ROLES.ADMIN ? null : req.user._id;
    const newStatus = req.user.role === USER_ROLES.ADMIN ? IMEI_STATUS.IN_STOCK : IMEI_STATUS.ALLOCATED;

    // Create recall record
    const recall = await StockAllocation.create({
      imeiId: imei._id,
      imei: imei.imei,
      productId: imei.productId._id,
      fromUserId: currentHolder._id,
      toUserId: req.user._id,
      fromLevel: currentHolder.role,
      toLevel: req.user.role,
      type: ALLOCATION_TYPE.RECALL,
      status: ALLOCATION_STATUS.RECALLED,
      recallReason: reason,
      recalledAt: new Date(),
      recalledBy: req.user._id
    });

    // Update IMEI
    imei.status = newStatus;
    imei.currentHolderId = newHolderId;
    await imei.save();

    await recall.populate('productId', 'name category');
    await recall.populate('fromUserId', 'name email role');

    res.status(201).json({
      success: true,
      data: recall,
      message: `Stock recalled from ${currentHolder.name}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk recall stock
// @route   POST /api/stock-allocations/bulk-recall
// @access  Private (Admin, RM, TL)
exports.bulkRecallStock = async (req, res, next) => {
  try {
    const { imeiIds, reason } = req.body;

    const results = {
      success: [],
      failed: []
    };

    for (const imeiId of imeiIds) {
      try {
        const imei = await IMEI.findById(imeiId).populate('productId').populate('currentHolderId');
        
        if (!imei) {
          results.failed.push({ imeiId, reason: 'IMEI not found' });
          continue;
        }

        if (imei.status === IMEI_STATUS.SOLD) {
          results.failed.push({ imeiId, reason: 'Already sold' });
          continue;
        }

        if (!imei.currentHolderId) {
          results.failed.push({ imeiId, reason: 'Not allocated' });
          continue;
        }

        const currentHolder = imei.currentHolderId;
        const validationResult = validateRecallHierarchy(req.user, currentHolder);
        if (!validationResult.valid) {
          results.failed.push({ imeiId, reason: validationResult.message });
          continue;
        }

        const newHolderId = req.user.role === USER_ROLES.ADMIN ? null : req.user._id;
        const newStatus = req.user.role === USER_ROLES.ADMIN ? IMEI_STATUS.IN_STOCK : IMEI_STATUS.ALLOCATED;

        // Create recall record
        await StockAllocation.create({
          imeiId: imei._id,
          imei: imei.imei,
          productId: imei.productId._id,
          fromUserId: currentHolder._id,
          toUserId: req.user._id,
          fromLevel: currentHolder.role,
          toLevel: req.user.role,
          type: ALLOCATION_TYPE.RECALL,
          status: ALLOCATION_STATUS.RECALLED,
          recallReason: reason,
          recalledAt: new Date(),
          recalledBy: req.user._id
        });

        // Update IMEI
        imei.status = newStatus;
        imei.currentHolderId = newHolderId;
        await imei.save();

        results.success.push(imei.imei);
      } catch (err) {
        results.failed.push({ imeiId, reason: err.message });
      }
    }

    res.status(201).json({
      success: true,
      data: results,
      message: `${results.success.length} recalled, ${results.failed.length} failed`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recallable stock (stock held by subordinates)
// @route   GET /api/stock-allocations/recallable-stock
// @access  Private (Admin, RM, TL)
exports.getRecallableStock = async (req, res, next) => {
  try {
    let subordinateIds = [];

    if (req.user.role === USER_ROLES.ADMIN) {
      // Admin can recall from everyone
      const subordinates = await User.find({
        role: { $in: [USER_ROLES.REGIONAL_MANAGER, USER_ROLES.TEAM_LEADER, USER_ROLES.FIELD_OFFICER] },
        isActive: true
      }).select('_id');
      subordinateIds = subordinates.map(u => u._id);
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      // RM can recall from TLs and FOs in their region
      const subordinates = await User.find({
        region: req.user.region,
        role: { $in: [USER_ROLES.TEAM_LEADER, USER_ROLES.FIELD_OFFICER] },
        isActive: true
      }).select('_id');
      subordinateIds = subordinates.map(u => u._id);
    } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
      // TL can recall from their FOs
      const subordinates = await User.find({
        teamLeaderId: req.user._id,
        role: USER_ROLES.FIELD_OFFICER,
        isActive: true
      }).select('_id');
      subordinateIds = subordinates.map(u => u._id);
    } else {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const stock = await IMEI.find({
      currentHolderId: { $in: subordinateIds },
      status: IMEI_STATUS.ALLOCATED
    })
      .populate('productId', 'name category price brand')
      .populate('currentHolderId', 'name email role region')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: stock.length,
      data: stock
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock journey/history for an IMEI
// @route   GET /api/stock-allocations/journey/:imeiId
// @access  Private
exports.getStockJourney = async (req, res, next) => {
  try {
    const { imeiId } = req.params;

    const imei = await IMEI.findById(imeiId)
      .populate('productId', 'name category price')
      .populate('currentHolderId', 'name email role')
      .populate('registeredBy', 'name email role');

    if (!imei) {
      return res.status(404).json({
        success: false,
        message: 'IMEI not found'
      });
    }

    // Get all allocation/recall history
    const history = await StockAllocation.find({ imeiId })
      .populate('fromUserId', 'name email role region')
      .populate('toUserId', 'name email role region')
      .populate('recalledBy', 'name email role')
      .sort({ createdAt: 1 });

    // Build timeline
    const timeline = [
      {
        type: 'registered',
        date: imei.registeredAt || imei.createdAt,
        user: imei.registeredBy,
        details: 'Device registered in inventory'
      }
    ];

    history.forEach(record => {
      if (record.type === ALLOCATION_TYPE.ALLOCATION) {
        timeline.push({
          type: 'allocation',
          date: record.createdAt,
          fromUser: record.fromUserId,
          toUser: record.toUserId,
          notes: record.notes,
          details: `Allocated from ${record.fromUserId?.name || 'Admin'} to ${record.toUserId?.name}`
        });
      } else if (record.type === ALLOCATION_TYPE.RECALL) {
        timeline.push({
          type: 'recall',
          date: record.recalledAt || record.createdAt,
          fromUser: record.fromUserId,
          toUser: record.toUserId,
          reason: record.recallReason,
          recalledBy: record.recalledBy,
          details: `Recalled from ${record.fromUserId?.name} by ${record.recalledBy?.name || record.toUserId?.name}`
        });
      }
    });

    if (imei.status === IMEI_STATUS.SOLD && imei.soldAt) {
      timeline.push({
        type: 'sold',
        date: imei.soldAt,
        details: 'Device sold to customer'
      });
    }

    res.json({
      success: true,
      data: {
        imei,
        timeline,
        history
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get workflow stats
// @route   GET /api/stock-allocations/workflow-stats
// @access  Private
exports.getWorkflowStats = async (req, res, next) => {
  try {
    // Get stock counts by holder role
    const inStock = await IMEI.countDocuments({ status: IMEI_STATUS.IN_STOCK, currentHolderId: null });
    
    const rmUsers = await User.find({ role: USER_ROLES.REGIONAL_MANAGER }).select('_id');
    const tlUsers = await User.find({ role: USER_ROLES.TEAM_LEADER }).select('_id');
    const foUsers = await User.find({ role: USER_ROLES.FIELD_OFFICER }).select('_id');

    const atRegionalManagers = await IMEI.countDocuments({
      status: IMEI_STATUS.ALLOCATED,
      currentHolderId: { $in: rmUsers.map(u => u._id) }
    });

    const atTeamLeaders = await IMEI.countDocuments({
      status: IMEI_STATUS.ALLOCATED,
      currentHolderId: { $in: tlUsers.map(u => u._id) }
    });

    const atFieldOfficers = await IMEI.countDocuments({
      status: IMEI_STATUS.ALLOCATED,
      currentHolderId: { $in: foUsers.map(u => u._id) }
    });

    const sold = await IMEI.countDocuments({ status: IMEI_STATUS.SOLD });

    // Get recent allocations and recalls
    const recentAllocations = await StockAllocation.find({ type: ALLOCATION_TYPE.ALLOCATION })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('fromUserId', 'name role')
      .populate('toUserId', 'name role')
      .populate('productId', 'name');

    const recentRecalls = await StockAllocation.find({ type: ALLOCATION_TYPE.RECALL })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('fromUserId', 'name role')
      .populate('toUserId', 'name role')
      .populate('recalledBy', 'name role')
      .populate('productId', 'name');

    res.json({
      success: true,
      data: {
        pipeline: {
          inStock,
          atRegionalManagers,
          atTeamLeaders,
          atFieldOfficers,
          sold,
          total: inStock + atRegionalManagers + atTeamLeaders + atFieldOfficers + sold
        },
        userCounts: {
          regionalManagers: rmUsers.length,
          teamLeaders: tlUsers.length,
          fieldOfficers: foUsers.length
        },
        recentActivity: {
          allocations: recentAllocations,
          recalls: recentRecalls
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get allocatable users (who current user can allocate to)
// @route   GET /api/stock-allocations/allocatable-users
// @access  Private
exports.getAllocatableUsers = async (req, res, next) => {
  try {
    let query = { isActive: true };

    if (req.user.role === USER_ROLES.ADMIN) {
      // Admin can allocate to Regional Managers
      query.role = USER_ROLES.REGIONAL_MANAGER;
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      // RM can allocate to Team Leaders in their region
      query.role = USER_ROLES.TEAM_LEADER;
      query.region = req.user.region;
    } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
      // TL can allocate to Field Officers in their team
      query.role = USER_ROLES.FIELD_OFFICER;
      query.teamLeaderId = req.user._id;
    } else {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const users = await User.find(query).select('name email role region');

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock available for allocation
// @route   GET /api/stock-allocations/available-stock
// @access  Private
exports.getAvailableStock = async (req, res, next) => {
  try {
    let query = {};

    if (req.user.role === USER_ROLES.ADMIN) {
      // Admin sees all unallocated stock
      query = { status: IMEI_STATUS.IN_STOCK, currentHolderId: null };
    } else {
      // Others see stock allocated to them
      query = { currentHolderId: req.user._id, status: IMEI_STATUS.ALLOCATED };
    }

    const stock = await IMEI.find(query)
      .populate('productId', 'name category price brand')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: stock.length,
      data: stock
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subordinates with their stock counts
// @route   GET /api/stock-allocations/subordinates
// @access  Private (Admin, RM, TL)
exports.getSubordinatesWithStock = async (req, res, next) => {
  try {
    let subordinateQuery = {};

    if (req.user.role === USER_ROLES.ADMIN) {
      subordinateQuery = {
        role: { $in: [USER_ROLES.REGIONAL_MANAGER, USER_ROLES.TEAM_LEADER, USER_ROLES.FIELD_OFFICER] },
        isActive: true
      };
    } else if (req.user.role === USER_ROLES.REGIONAL_MANAGER) {
      subordinateQuery = {
        region: req.user.region,
        role: { $in: [USER_ROLES.TEAM_LEADER, USER_ROLES.FIELD_OFFICER] },
        isActive: true
      };
    } else if (req.user.role === USER_ROLES.TEAM_LEADER) {
      subordinateQuery = {
        teamLeaderId: req.user._id,
        role: USER_ROLES.FIELD_OFFICER,
        isActive: true
      };
    } else {
      return res.json({ success: true, data: [] });
    }

    const subordinates = await User.find(subordinateQuery).select('name email role region teamLeaderId');

    // Get stock counts for each subordinate
    const subordinatesWithStock = await Promise.all(
      subordinates.map(async (sub) => {
        const stockCount = await IMEI.countDocuments({
          currentHolderId: sub._id,
          status: IMEI_STATUS.ALLOCATED
        });

        const soldCount = await IMEI.countDocuments({
          soldBy: sub._id,
          status: IMEI_STATUS.SOLD
        });

        // Get recent allocations
        const recentAllocations = await StockAllocation.find({
          toUserId: sub._id,
          type: ALLOCATION_TYPE.ALLOCATION
        })
          .sort({ createdAt: -1 })
          .limit(5);

        return {
          ...sub.toObject(),
          stockCount,
          soldCount,
          sellThroughRate: stockCount + soldCount > 0 
            ? Math.round((soldCount / (stockCount + soldCount)) * 100) 
            : 0,
          recentAllocationsCount: recentAllocations.length
        };
      })
    );

    res.json({
      success: true,
      count: subordinatesWithStock.length,
      data: subordinatesWithStock
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to validate allocation hierarchy
function validateAllocationHierarchy(fromUser, toUser, imei) {
  const hierarchy = {
    [USER_ROLES.ADMIN]: [USER_ROLES.REGIONAL_MANAGER],
    [USER_ROLES.REGIONAL_MANAGER]: [USER_ROLES.TEAM_LEADER],
    [USER_ROLES.TEAM_LEADER]: [USER_ROLES.FIELD_OFFICER]
  };

  // Check role hierarchy
  const allowedRoles = hierarchy[fromUser.role];
  if (!allowedRoles || !allowedRoles.includes(toUser.role)) {
    return {
      valid: false,
      message: `Cannot allocate from ${fromUser.role} to ${toUser.role}`
    };
  }

  // Check if sender has the stock (except admin)
  if (fromUser.role !== USER_ROLES.ADMIN) {
    if (!imei.currentHolderId || imei.currentHolderId.toString() !== fromUser._id.toString()) {
      return {
        valid: false,
        message: 'You do not have this stock to allocate'
      };
    }
  }

  // Check region for Regional Manager
  if (fromUser.role === USER_ROLES.REGIONAL_MANAGER && toUser.region !== fromUser.region) {
    return {
      valid: false,
      message: 'Cannot allocate to user in different region'
    };
  }

  // Check team for Team Leader
  if (fromUser.role === USER_ROLES.TEAM_LEADER) {
    if (!toUser.teamLeaderId || toUser.teamLeaderId.toString() !== fromUser._id.toString()) {
      return {
        valid: false,
        message: 'Can only allocate to your team members'
      };
    }
  }

  return { valid: true };
}

// Helper function to validate recall hierarchy
function validateRecallHierarchy(recaller, currentHolder) {
  // Admin can recall from anyone
  if (recaller.role === USER_ROLES.ADMIN) {
    return { valid: true };
  }

  // Check role level - can only recall from lower roles
  const recallerLevel = ROLE_HIERARCHY[recaller.role];
  const holderLevel = ROLE_HIERARCHY[currentHolder.role];

  if (recallerLevel >= holderLevel) {
    return {
      valid: false,
      message: `Cannot recall from ${currentHolder.role} - they are at same or higher level`
    };
  }

  // Regional Manager can only recall from their region
  if (recaller.role === USER_ROLES.REGIONAL_MANAGER) {
    if (currentHolder.region !== recaller.region) {
      return {
        valid: false,
        message: 'Cannot recall from user in different region'
      };
    }
  }

  // Team Leader can only recall from their team
  if (recaller.role === USER_ROLES.TEAM_LEADER) {
    if (!currentHolder.teamLeaderId || currentHolder.teamLeaderId.toString() !== recaller._id.toString()) {
      return {
        valid: false,
        message: 'Can only recall from your team members'
      };
    }
  }

  return { valid: true };
}
