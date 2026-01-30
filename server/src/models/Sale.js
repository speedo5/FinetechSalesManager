const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/constants');

const saleSchema = new mongoose.Schema({
  receiptNumber: {
    type: String,
    unique: true,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  imeiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IMEI'
  },
  imei: {
    type: String
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  saleAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: Object.values(PAYMENT_METHODS),
    default: PAYMENT_METHODS.CASH
  },
  paymentReference: {
    type: String
  },
  etrReceiptNo: {
    type: String
  },
  soldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true
  },
  customerIdNumber: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ['watu', 'mogo', 'onfon'],
    default: 'watu'
  },
  region: {
    type: String,
    required: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Generate receipt number before saving
saleSchema.pre('save', async function(next) {
  try {
    if (!this.receiptNumber) {
      const Sale = mongoose.model('Sale');
      const count = await Sale.countDocuments({});
      this.receiptNumber = `RCP-${String(2000 + count + 1).padStart(6, '0')}`;
    }
    next();
  } catch (error) {
    console.error('Error generating receipt number:', error);
    next(error);
  }
});

// Index for reporting queries
saleSchema.index({ soldBy: 1, createdAt: -1 });
saleSchema.index({ region: 1, createdAt: -1 });
saleSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
