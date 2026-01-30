const Product = require('../models/Product');
const IMEI = require('../models/IMEI');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res, next) => {
  try {
    const { category, isActive, search } = req.query;

    let query = {};

    if (category) {
      query.category = category;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query).sort({ createdAt: -1 });

    // Get stock counts for each product
    const productsWithStock = await Promise.all(
      products.map(async (product) => {
        const stockCount = await IMEI.countDocuments({
          productId: product._id,
          status: 'in_stock'
        });
        return {
          ...product.toObject(),
          stockCount
        };
      })
    );

    res.json({
      success: true,
      count: products.length,
      data: productsWithStock
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const stockCount = await IMEI.countDocuments({
      productId: product._id,
      status: 'in_stock'
    });

    res.json({
      success: true,
      data: {
        ...product.toObject(),
        stockCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private (Admin)
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin)
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private (Admin)
exports.deleteProduct = async (req, res, next) => {
  try {
    // Check if product has any stock
    const stockCount = await IMEI.countDocuments({
      productId: req.params.id,
      status: { $in: ['in_stock', 'allocated'] }
    });

    if (stockCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete product with existing stock'
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deactivated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Private
exports.getCategories = async (req, res, next) => {
  try {
    const { PRODUCT_CATEGORIES } = require('../config/constants');

    res.json({
      success: true,
      data: PRODUCT_CATEGORIES
    });
  } catch (error) {
    next(error);
  }
};
