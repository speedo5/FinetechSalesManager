module.exports = {
  USER_ROLES: {
    ADMIN: 'admin',
    REGIONAL_MANAGER: 'regional_manager',
    TEAM_LEADER: 'team_leader',
    FIELD_OFFICER: 'field_officer'
  },

  IMEI_STATUS: {
    IN_STOCK: 'in_stock',
    ALLOCATED: 'allocated',
    SOLD: 'sold',
    RETURNED: 'returned',
    DEFECTIVE: 'defective',
    LOCKED: 'locked',
    LOST: 'lost'
  },

  ALLOCATION_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    RETURNED: 'returned',
    RECALLED: 'recalled'
  },

  ALLOCATION_TYPE: {
    ALLOCATION: 'allocation',
    RECALL: 'recall'
  },

  COMMISSION_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    PAID: 'paid',
    REJECTED: 'rejected'
  },

  PAYMENT_METHODS: {
    CASH: 'cash',
    MPESA: 'mpesa'
  },

  PRODUCT_CATEGORIES: [
    'Smartphones',
    'Feature Phones',
    'Tablets',
    'Accessories',
    'SIM Cards',
    'Airtime'
  ],

  PHONE_SOURCES: [
    'watu',
    'mogo',
    'onfon'
  ],

  REGIONS: [
    'Nairobi',
    'Central',
    'Coast',
    'Western',
    'Rift Valley',
    'Eastern',
    'North Eastern',
    'Nyanza'
  ],

  // Role hierarchy levels for allocation/recall validation
  ROLE_HIERARCHY: {
    admin: 0,
    regional_manager: 1,
    team_leader: 2,
    field_officer: 3
  }
};
