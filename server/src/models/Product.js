const mongoose = require('mongoose');
const { PRODUCT_CATEGORIES } = require('../config/constants');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: PRODUCT_CATEGORIES
  },
  brand: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  costPrice: {
    type: Number,
    min: 0
  },
  description: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  commissionConfig: {
    foCommission: {
      type: Number,
      default: 0
    },
    teamLeaderCommission: {
      type: Number,
      default: 0
    },
    regionalManagerCommission: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual for stock count
productSchema.virtual('stockCount', {
  ref: 'IMEI',
  localField: '_id',
  foreignField: 'productId',
  count: true,
  match: { status: 'in_stock' }
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
