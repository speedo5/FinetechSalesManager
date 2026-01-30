const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  getCommissionReport,
  getInventoryReport,
  getAllocationReport,
  getPerformanceReport,
  exportSalesReport,
  getComprehensiveReport,
  getCompanyPerformance,
  getTopProducts,
  getActiveFOs
} = require('../controllers/report.controller');
const { protect, authorize } = require('../middlewares/auth');

router.use(protect);

router.get('/sales', getSalesReport);
router.get('/commissions', getCommissionReport);
router.get('/inventory', authorize('admin', 'regional_manager'), getInventoryReport);
router.get('/allocations', getAllocationReport);
router.get('/performance', authorize('admin', 'regional_manager'), getPerformanceReport);
router.get('/top-products', getTopProducts);
router.get('/active-fos', getActiveFOs);
router.get('/company-performance', getCompanyPerformance);
router.get('/comprehensive', authorize('admin', 'regional_manager'), getComprehensiveReport);
router.get('/sales/export', exportSalesReport);

module.exports = router;
