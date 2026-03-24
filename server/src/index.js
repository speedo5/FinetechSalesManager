const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/database');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/regions', require('./routes/region.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/imei', require('./routes/imei.routes'));
app.use('/api/sales', require('./routes/sale.routes'));
app.use('/api/commissions', require('./routes/commission.routes'));
app.use('/api/team-leader/commissions', require('./routes/teamLeaderCommission.routes'));
app.use('/api/stock-allocations', require('./routes/stockAllocation.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/performance', require('./routes/performance.routes'));
app.use('/api/activity-logs', require('./routes/activityLog.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Finetech POS API is running' });
});

// Error handling middleware
app.use(require('./middlewares/errorHandler'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
