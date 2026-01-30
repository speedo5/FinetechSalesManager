const express = require('express');
const {
  getPerformanceOverview,
  getPerformanceByRegion,
  getPerformanceByProduct,
  getPerformanceByFO,
  getPaymentMethodBreakdown,
  getComprehensiveReport
} = require('../controllers/performanceReport.controller');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Performance endpoints
router.get('/overview', getPerformanceOverview);
router.get('/by-region', getPerformanceByRegion);
router.get('/by-product', getPerformanceByProduct);
router.get('/by-fo', getPerformanceByFO);
router.get('/payment-methods', getPaymentMethodBreakdown);
router.get('/comprehensive', getComprehensiveReport);

module.exports = router;
