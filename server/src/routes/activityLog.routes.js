const express = require('express');
const { 
  getActivityLogs, 
  getActivityLog, 
  createActivityLog,
  getMyActivityLogs,
  getEntityActivityLogs,
  deleteActivityLog,
  getActivityStats
} = require('../controllers/activityLog.controller');
const { protect } = require('../middlewares/auth');

const router = express.Router();

// All activity logs routes require authentication
router.use(protect);

// Get activity stats
router.get('/stats/summary', getActivityStats);

// Get current user's activity logs
router.get('/me/logs', getMyActivityLogs);

// Get all activity logs (with filtering)
router.get('/', getActivityLogs);

// Get activity logs for a specific entity
router.get('/entity/:entityType/:entityId', getEntityActivityLogs);

// Create activity log
router.post('/', createActivityLog);

// Get single activity log
router.get('/:id', getActivityLog);

// Delete activity log (Admin only)
router.delete('/:id', deleteActivityLog);

module.exports = router;
