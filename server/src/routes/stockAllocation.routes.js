const express = require('express');
const router = express.Router();
const {
  getAllocations,
  allocateStock,
  bulkAllocateStock,
  recallStock,
  bulkRecallStock,
  getRecallableStock,
  getStockJourney,
  getWorkflowStats,
  getAllocatableUsers,
  getAvailableStock,
  getSubordinatesWithStock
} = require('../controllers/stockAllocation.controller');
const { protect, authorize } = require('../middlewares/auth');
const { allocationValidation, recallValidation, validate } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

router.use(protect);

// Get allocations and stats
router.get('/', getAllocations);
router.get('/allocatable-users', getAllocatableUsers);
router.get('/available-stock', getAvailableStock);
router.get('/recallable-stock', authorize('admin', 'regional_manager', 'team_leader'), getRecallableStock);
router.get('/subordinates', authorize('admin', 'regional_manager', 'team_leader'), getSubordinatesWithStock);
router.get('/workflow-stats', getWorkflowStats);
router.get('/journey/:imeiId', getStockJourney);

// Allocate stock - Admin, RM, TL
router.post(
  '/',
  authorize('admin', 'regional_manager', 'team_leader'),
  allocationValidation,
  validate,
  logActivity('stock_allocated', 'stock_allocation'),
  allocateStock
);

router.post(
  '/bulk',
  authorize('admin', 'regional_manager', 'team_leader'),
  logActivity('stock_bulk_allocated', 'stock_allocation'),
  bulkAllocateStock
);

// Recall stock - Admin, RM, TL
router.post(
  '/recall',
  authorize('admin', 'regional_manager', 'team_leader'),
  recallValidation,
  validate,
  logActivity('stock_recalled', 'stock_allocation'),
  recallStock
);

router.post(
  '/bulk-recall',
  authorize('admin', 'regional_manager', 'team_leader'),
  logActivity('stock_bulk_recalled', 'stock_allocation'),
  bulkRecallStock
);

module.exports = router;