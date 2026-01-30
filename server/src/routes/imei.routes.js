const express = require('express');
const router = express.Router();
const {
  getIMEIs,
  getIMEI,
  registerIMEI,
  bulkRegisterIMEI,
  updateIMEI,
  getMyStock,
  searchIMEI
} = require('../controllers/imei.controller');
const { protect, authorize } = require('../middlewares/auth');
const { imeiValidation, mongoIdParam, validate } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

router.use(protect);

// Get IMEIs
router.get('/', getIMEIs);
router.get('/my-stock', getMyStock);
router.get('/search/:imeiNumber', searchIMEI);
router.get('/:id', mongoIdParam, validate, getIMEI);

// Admin only - register IMEIs
router.post(
  '/',
  authorize('admin'),
  imeiValidation,
  validate,
  logActivity('imei_registered', 'imei'),
  registerIMEI
);

router.post(
  '/bulk',
  authorize('admin'),
  logActivity('imei_bulk_registered', 'imei'),
  bulkRegisterIMEI
);

router.put(
  '/:id',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('imei_updated', 'imei'),
  updateIMEI
);

module.exports = router;
