const ActivityLog = require('../models/ActivityLog');

const logActivity = (action, entityType) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to log after successful response
    res.json = async function(data) {
      // Only log successful operations
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          await ActivityLog.create({
            userId: req.user._id,
            action: action,
            entityType: entityType,
            entityId: data.data?._id || req.params.id,
            details: {
              method: req.method,
              path: req.originalUrl,
              body: sanitizeBody(req.body)
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
          });
        } catch (error) {
          console.error('Failed to log activity:', error);
        }
      }

      return originalJson(data);
    };

    next();
  };
};

// Remove sensitive data from logged body
const sanitizeBody = (body) => {
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
};

module.exports = logActivity;
