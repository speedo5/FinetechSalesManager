const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories
} = require('../controllers/product.controller');
const { protect, authorize } = require('../middlewares/auth');
const { productValidation, mongoIdParam, validate } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

router.use(protect);

// Get products and categories
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', mongoIdParam, validate, getProduct);

// Admin only operations
router.post(
  '/',
  authorize('admin'),
  productValidation,
  validate,
  logActivity('product_created', 'product'),
  createProduct
);

router.put(
  '/:id',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('product_updated', 'product'),
  updateProduct
);

router.delete(
  '/:id',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('product_deleted', 'product'),
  deleteProduct
);

module.exports = router;
