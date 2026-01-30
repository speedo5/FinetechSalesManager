const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Auth validations
exports.loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

exports.registerValidation = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'regional_manager', 'team_leader', 'field_officer']).withMessage('Invalid role'),
  body('region').notEmpty().withMessage('Region is required')
];

// Product validations
exports.productValidation = [
  body('name').notEmpty().trim().withMessage('Product name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('price').isNumeric().withMessage('Price must be a number')
];

// IMEI validations
exports.imeiValidation = [
  body('imei').isLength({ min: 15, max: 15 }).withMessage('IMEI must be 15 digits'),
  body('productId').isMongoId().withMessage('Valid product ID is required')
];

// Sale validations
exports.saleValidation = [
  body('imeiId').optional().isMongoId().withMessage('Valid IMEI ID is required'),
  body('productId').optional().isMongoId().withMessage('Valid Product ID is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('paymentMethod').isString().notEmpty().withMessage('Payment method is required')
];

// Stock allocation validations
exports.allocationValidation = [
  body('imeiId').isMongoId().withMessage('Valid IMEI ID is required'),
  // toUserId can be either a MongoDB ObjectId or a user name/identifier string
  body('toUserId').notEmpty().isString().trim().withMessage('Valid recipient user ID or name is required')
];

// Stock recall validations
exports.recallValidation = [
  body('imeiId').isMongoId().withMessage('Valid IMEI ID is required'),
  body('reason').optional().isString().trim().withMessage('Reason must be a string')
];

// Bulk allocation validations
exports.bulkAllocationValidation = [
  body('imeiIds').isArray({ min: 1 }).withMessage('At least one IMEI ID is required'),
  body('imeiIds.*').isMongoId().withMessage('All IMEI IDs must be valid'),
  // toUserId can be either a MongoDB ObjectId or a user name/identifier string
  body('toUserId').notEmpty().isString().trim().withMessage('Valid recipient user ID or name is required')
];

// Bulk recall validations
exports.bulkRecallValidation = [
  body('imeiIds').isArray({ min: 1 }).withMessage('At least one IMEI ID is required'),
  body('imeiIds.*').isMongoId().withMessage('All IMEI IDs must be valid'),
  body('reason').optional().isString().trim().withMessage('Reason must be a string')
];

// MongoDB ID param validation
exports.mongoIdParam = [
  param('id').isMongoId().withMessage('Invalid ID format')
];

// Pagination query validation
exports.paginationQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];
