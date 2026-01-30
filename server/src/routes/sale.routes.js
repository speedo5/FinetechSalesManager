const express = require('express');
const router = express.Router();
const {
  getSales,
  getSale,
  createSale,
  getMySales,
  getSalesSummary
} = require('../controllers/sale.controller');
const { protect } = require('../middlewares/auth');
const { saleValidation, mongoIdParam, validate } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

router.use(protect);

// Get sales
router.get('/', getSales);
router.get('/my-sales', getMySales);
router.get('/summary', getSalesSummary);
router.get('/:id', mongoIdParam, validate, getSale);

// Create sale
router.post(
  '/',
  saleValidation,
  validate,
  logActivity('sale_created', 'sale'),
  createSale
);

module.exports = router;
