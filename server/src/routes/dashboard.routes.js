const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getSalesChartData,
  getTopPerformers,
  getRegionalStats
} = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/sales-chart', getSalesChartData);
router.get('/top-performers', authorize('admin', 'regional_manager'), getTopPerformers);
router.get('/regional-stats', authorize('admin'), getRegionalStats);

module.exports = router;
