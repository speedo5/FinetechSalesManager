const mongoose = require('mongoose');
const { IMEI_STATUS } = require('../config/constants');

const imeiSchema = new mongoose.Schema({
  imei: {
    type: String,
    required: [true, 'IMEI is required'],
    unique: true,
    trim: true,
    minlength: 15,
    maxlength: 15
  },
  imei2: {
    type: String,
    trim: true,
    minlength: 15,
    maxlength: 15
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  price: {
    type: Number,
    description: 'Selling price for this IMEI (overrides product price if set)'
  },
  status: {
    type: String,
    enum: Object.values(IMEI_STATUS),
    default: IMEI_STATUS.IN_STOCK
  },
  currentHolderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  region: {
    type: String,
    description: 'Region where this device is allocated'
  },
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  registeredAt: {
    type: Date,
    default: Date.now
  },
  soldAt: {
    type: Date
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  source: {
    type: String,
    enum: ['watu', 'mogo', 'onfon'],
    default: 'watu',
    description: 'Source company (supplier) of the phone'
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
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for faster queries
imeiSchema.index({ status: 1 });
imeiSchema.index({ currentHolderId: 1 });
imeiSchema.index({ productId: 1 });

module.exports = mongoose.model('IMEI', imeiSchema);
