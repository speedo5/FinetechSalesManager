/**
 * =============================================================================
 * TEAM LEADER COMMISSION CONTROLLER
 * =============================================================================
 * 
 * Handles commission operations specific to team leaders:
 * - View own commissions
 * - View team FO commissions (read-only)
 * - Get team commission summary
 * 
 * ENDPOINTS:
 * - GET /team-leader/commissions/my - Get own commissions
 * - GET /team-leader/commissions/team - Get team FO commissions
 * - GET /team-leader/commissions/summary - Get combined summary
 * 
 * SAMPLE RESPONSES:
 * -----------------
 * GET /team-leader/commissions/my
 * {
 *   success: true,
 *   data: {
 *     commissions: [...],
 *     summary: { total: 50000, pending: 20000, paid: 30000 }
 *   }
 * }
 * 
 * GET /team-leader/commissions/team
 * {
 *   success: true,
 *   data: {
 *     commissions: [...],
 *     foSummaries: [{ foId, foName, pending, paid, count }],
 *     totals: { pending: 100000, paid: 250000 }
 *   }
 * }
 * 
 * =============================================================================
 */

const Commission = require('../models/Commission');
const User = require('../models/User');
const { USER_ROLES, COMMISSION_STATUS } = require('../config/constants');

/**
 * Get team leader's own commissions
 * @route GET /api/team-leader/commissions/my
 * @access Private (Team Leader only)
 */
const getMyCommissions = async (req, res, next) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    // Build query for own commissions
    const query = { userId: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [commissions, total] = await Promise.all([
      Commission.find(query)
        .populate('saleId', 'imei productName customerName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Commission.countDocuments(query)
    ]);
    
    // Calculate summary
    const allCommissions = await Commission.find({ userId: req.user._id });
    const summary = {
      total: allCommissions.reduce((sum, c) => sum + c.amount, 0),
      pending: allCommissions.filter(c => c.status === COMMISSION_STATUS.PENDING).reduce((sum, c) => sum + c.amount, 0),
      paid: allCommissions.filter(c => c.status === COMMISSION_STATUS.PAID).reduce((sum, c) => sum + c.amount, 0),
      count: allCommissions.length
    };
    
    res.json({
      success: true,
      data: {
        commissions,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get team FO commissions (read-only view)
 * @route GET /api/team-leader/commissions/team
 * @access Private (Team Leader only)
 */
const getTeamCommissions = async (req, res, next) => {
  try {
    const { foId, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    // Get all FOs under this team leader
    const teamFOs = await User.find({
      teamLeaderId: req.user._id,
      role: USER_ROLES.FIELD_OFFICER
    }).select('_id name email');
    
    const foIds = teamFOs.map(fo => fo._id);
    
    // Build query
    const query = { userId: { $in: foIds } };
    
    if (foId) {
      // Verify this FO belongs to the team leader
      if (!foIds.some(id => id.toString() === foId)) {
        return res.status(403).json({
          success: false,
          message: 'This field officer is not in your team'
        });
      }
      query.userId = foId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [commissions, total] = await Promise.all([
      Commission.find(query)
        .populate('userId', 'name email')
        .populate('saleId', 'imei productName customerName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Commission.countDocuments(query)
    ]);
    
    // Calculate per-FO summaries
    const foSummaries = await Promise.all(teamFOs.map(async (fo) => {
      const foCommissions = await Commission.find({ userId: fo._id });
      return {
        foId: fo._id,
        foName: fo.name,
        foEmail: fo.email,
        pending: foCommissions.filter(c => c.status === COMMISSION_STATUS.PENDING).reduce((sum, c) => sum + c.amount, 0),
        paid: foCommissions.filter(c => c.status === COMMISSION_STATUS.PAID).reduce((sum, c) => sum + c.amount, 0),
        count: foCommissions.length
      };
    }));
    
    // Calculate totals
    const allTeamCommissions = await Commission.find({ userId: { $in: foIds } });
    const totals = {
      pending: allTeamCommissions.filter(c => c.status === COMMISSION_STATUS.PENDING).reduce((sum, c) => sum + c.amount, 0),
      paid: allTeamCommissions.filter(c => c.status === COMMISSION_STATUS.PAID).reduce((sum, c) => sum + c.amount, 0),
      total: allTeamCommissions.reduce((sum, c) => sum + c.amount, 0)
    };
    
    res.json({
      success: true,
      data: {
        commissions,
        foSummaries,
        totals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get combined commission summary for team leader
 * @route GET /api/team-leader/commissions/summary
 * @access Private (Team Leader only)
 */
const getCommissionSummary = async (req, res, next) => {
  try {
    // Get team FO IDs
    const teamFOs = await User.find({
      teamLeaderId: req.user._id,
      role: USER_ROLES.FIELD_OFFICER
    }).select('_id');
    
    const foIds = teamFOs.map(fo => fo._id);
    
    // Get own commissions
    const myCommissions = await Commission.find({ userId: req.user._id });
    const mySummary = {
      total: myCommissions.reduce((sum, c) => sum + c.amount, 0),
      pending: myCommissions.filter(c => c.status === COMMISSION_STATUS.PENDING).reduce((sum, c) => sum + c.amount, 0),
      paid: myCommissions.filter(c => c.status === COMMISSION_STATUS.PAID).reduce((sum, c) => sum + c.amount, 0)
    };
    
    // Get team commissions
    const teamCommissions = await Commission.find({ userId: { $in: foIds } });
    const teamSummary = {
      total: teamCommissions.reduce((sum, c) => sum + c.amount, 0),
      pending: teamCommissions.filter(c => c.status === COMMISSION_STATUS.PENDING).reduce((sum, c) => sum + c.amount, 0),
      paid: teamCommissions.filter(c => c.status === COMMISSION_STATUS.PAID).reduce((sum, c) => sum + c.amount, 0),
      foCount: foIds.length
    };
    
    res.json({
      success: true,
      data: {
        my: mySummary,
        team: teamSummary,
        combined: {
          total: mySummary.total + teamSummary.total,
          pending: mySummary.pending + teamSummary.pending,
          paid: mySummary.paid + teamSummary.paid
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyCommissions,
  getTeamCommissions,
  getCommissionSummary
};
