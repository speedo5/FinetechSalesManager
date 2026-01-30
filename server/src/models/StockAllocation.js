const mongoose = require('mongoose');
const { ALLOCATION_STATUS, ALLOCATION_TYPE } = require('../config/constants');

const stockAllocationSchema = new mongoose.Schema({
  imeiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IMEI',
    required: true
  },
  imei: {
    type: String,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  fromUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fromLevel: {
    type: String,
    enum: ['admin', 'regional_manager', 'team_leader', 'field_officer'],
    required: true
  },
  toLevel: {
    type: String,
    enum: ['admin', 'regional_manager', 'team_leader', 'field_officer'],
    required: true
  },
  type: {
    type: String,
    enum: Object.values(ALLOCATION_TYPE),
    default: ALLOCATION_TYPE.ALLOCATION
  },
  status: {
    type: String,
    enum: Object.values(ALLOCATION_STATUS),
    default: ALLOCATION_STATUS.COMPLETED
  },
  notes: {
    type: String
  },
  recallReason: {
    type: String
  },
  recalledAt: {
    type: Date
  },
  recalledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for allocation queries
stockAllocationSchema.index({ fromUserId: 1, createdAt: -1 });
stockAllocationSchema.index({ toUserId: 1, createdAt: -1 });
stockAllocationSchema.index({ imeiId: 1, createdAt: -1 });
stockAllocationSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('StockAllocation', stockAllocationSchema);
