const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updatePassword,
  logout
} = require('../controllers/auth.controller');
const { protect, authorize } = require('../middlewares/auth');
const { loginValidation, registerValidation, validate } = require('../middlewares/validation');
const logActivity = require('../middlewares/activityLogger');

// Public routes
router.post('/login', loginValidation, validate, login);

// Protected routes
router.use(protect);

router.get('/me', getMe);
router.put('/update-password', updatePassword);
router.post('/logout', logout);

// Admin only
router.post(
  '/register',
  authorize('admin'),
  registerValidation,
  validate,
  logActivity('user_created', 'user'),
  register
);

module.exports = router;
