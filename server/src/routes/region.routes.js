const express = require('express');
const router = express.Router();
const {
  getRegions,
  getRegion,
  createRegion,
  updateRegion,
  deleteRegion,
  getRegionStats
} = require('../controllers/region.controller');
const { protect, authorize } = require('../middlewares/auth');
const { mongoIdParam, validate } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

router.use(protect);

// Get all regions
router.get('/', getRegions);

// Get region stats
router.get('/:id/stats', mongoIdParam, validate, getRegionStats);

// Get single region
router.get('/:id', mongoIdParam, validate, getRegion);

// Create region (Admin only)
router.post(
  '/',
  authorize('admin'),
  logActivity('region_created', 'region'),
  createRegion
);

// Update region (Admin only)
router.put(
  '/:id',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('region_updated', 'region'),
  updateRegion
);

// Delete region (Admin only)
router.delete(
  '/:id',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('region_deleted', 'region'),
  deleteRegion
);

module.exports = router;
