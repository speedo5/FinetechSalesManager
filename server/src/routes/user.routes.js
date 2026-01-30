const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getTeamMembers,
  assignTeamLeader,
  getUsersByRegion
} = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/auth');
const { mongoIdParam, validate, registerValidation } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

router.use(protect);

// Get users
router.get('/', authorize('admin', 'regional_manager', 'team_leader'), getUsers);
router.get('/team', authorize('team_leader'), getTeamMembers);
router.get('/region/:region', authorize('admin', 'regional_manager'), getUsersByRegion);

// Create user (Admin only)
router.post(
  '/',
  authorize('admin'),
  registerValidation,
  validate,
  logActivity('user_created', 'user'),
  createUser
);

// Single user operations
router.get('/:id', mongoIdParam, validate, getUser);

router.put(
  '/:id',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('user_updated', 'user'),
  updateUser
);

router.delete(
  '/:id',
  authorize('admin'),
  mongoIdParam,
  validate,
  logActivity('user_deleted', 'user'),
  deleteUser
);

// Assign FO to Team Leader
router.put(
  '/:id/assign-team-leader',
  authorize('admin', 'regional_manager'),
  mongoIdParam,
  validate,
  logActivity('fo_assigned', 'user'),
  assignTeamLeader
);

module.exports = router;
