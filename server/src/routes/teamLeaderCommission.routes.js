/**
 * =============================================================================
 * TEAM LEADER COMMISSION ROUTES
 * =============================================================================
 * 
 * Routes for team leader commission management.
 * All routes require authentication and team_leader role.
 * 
 * ENDPOINTS:
 * - GET /api/team-leader/commissions/my     - Get own commissions
 * - GET /api/team-leader/commissions/team   - Get team FO commissions
 * - GET /api/team-leader/commissions/summary - Get combined summary
 * 
 * =============================================================================
 */

const express = require('express');
const router = express.Router();
const {
  getMyCommissions,
  getTeamCommissions,
  getCommissionSummary
} = require('../controllers/teamLeaderCommission.controller');
const { protect, authorize } = require('../middlewares/auth');
const { USER_ROLES } = require('../config/constants');

// All routes require authentication and team_leader role
router.use(protect);
router.use(authorize(USER_ROLES.TEAM_LEADER));

// Get own commissions
router.get('/my', getMyCommissions);

// Get team FO commissions (read-only)
router.get('/team', getTeamCommissions);

// Get combined summary
router.get('/summary', getCommissionSummary);

module.exports = router;
