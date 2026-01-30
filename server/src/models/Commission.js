const mongoose = require('mongoose');
const { COMMISSION_STATUS, USER_ROLES } = require('../config/constants');

const commissionSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: [USER_ROLES.FIELD_OFFICER, USER_ROLES.TEAM_LEADER, USER_ROLES.REGIONAL_MANAGER],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: Object.values(COMMISSION_STATUS),
    default: COMMISSION_STATUS.PENDING
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  paymentReference: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
commissionSchema.index({ userId: 1, status: 1 });
commissionSchema.index({ saleId: 1 });
commissionSchema.index({ status: 1 });

module.exports = mongoose.model('Commission', commissionSchema);
