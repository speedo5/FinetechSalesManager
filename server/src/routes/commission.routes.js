const express = require('express');
const router = express.Router();
const {
  getCommissions,
  getMyCommissions,
  approveCommission,
  payCommission,
  bulkApproveCommissions,
  bulkPayCommissions,
  getCommissionSummary
} = require('../controllers/commission.controller');
const { protect, authorize } = require('../middlewares/auth');
const { mongoIdParam, validate } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

router.use(protect);

// Get commissions
router.get('/', getCommissions);
router.get('/my-commissions', getMyCommissions);
router.get('/summary/:userId', mongoIdParam, validate, getCommissionSummary);

// Admin operations
router.put(
  '/:id/approve',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('commission_approved', 'commission'),
  approveCommission
);

router.put(
  '/:id/pay',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('commission_paid', 'commission'),
  payCommission
);

router.put(
  '/bulk-approve',
  authorize('admin'),
  logActivity('commissions_bulk_approved', 'commission'),
  bulkApproveCommissions
);

router.put(
  '/bulk-pay',
  authorize('admin'),
  logActivity('commissions_bulk_paid', 'commission'),
  bulkPayCommissions
);

module.exports = router;
