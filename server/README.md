# Finetech POS Backend API

Node.js + Express backend for Finetech Media POS System.

## Quick Start (VS Code Integration)

### Prerequisites
- Node.js v18+ installed
- MongoDB running locally or MongoDB Atlas connection string

### Setup Steps

1. **Navigate to server directory**
```bash
cd server
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/finetech_pos
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

4. **Start the server**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The API will be available at `http://localhost:5000/api`

---

## Frontend Integration

### Configure API URL

Create a `.env` file in your frontend root:
```env
VITE_API_URL=http://localhost:5000/api
```

### Using the API Service

The frontend includes a pre-built API service at `src/lib/api.ts`. Import and use it:

```typescript
import api from '@/lib/api';

// Login
const { token, data: user } = await api.auth.login('email@example.com', 'password');

// Get dashboard stats
const { data: stats } = await api.dashboard.getStats();

// Allocate stock
await api.stockAllocation.allocate(imeiId, toUserId, 'Optional notes');

// Recall stock
await api.stockAllocation.recall(imeiId, 'Recall reason');

// Get workflow stats
const { data: workflow } = await api.stockAllocation.getWorkflowStats();
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user (Admin only) |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/change-password` | Change password |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users (filtered by role) |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create new user (Admin only) |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user (Admin only) |
| PUT | `/api/users/:id/assign-team-leader` | Assign FO to Team Leader |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Get product by ID |
| POST | `/api/products` | Create product (Admin only) |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product (Admin only) |

### IMEI/Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/imei` | List all IMEIs |
| GET | `/api/imei/:id` | Get IMEI by ID |
| GET | `/api/imei/search/:imei` | Search by IMEI number |
| POST | `/api/imei` | Register new IMEI (Admin only) |
| POST | `/api/imei/bulk` | Bulk register IMEIs |
| PUT | `/api/imei/:id` | Update IMEI |
| DELETE | `/api/imei/:id` | Delete IMEI (Admin only) |

### Stock Allocations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stock-allocations` | List all allocations |
| GET | `/api/stock-allocations/allocatable-users` | Get users you can allocate to |
| GET | `/api/stock-allocations/available-stock` | Get stock available for allocation |
| GET | `/api/stock-allocations/recallable-stock` | Get stock you can recall |
| GET | `/api/stock-allocations/subordinates` | Get subordinates with stock counts |
| GET | `/api/stock-allocations/workflow-stats` | Get pipeline/workflow statistics |
| GET | `/api/stock-allocations/journey/:imeiId` | Get complete IMEI journey/history |
| POST | `/api/stock-allocations` | Allocate stock to user |
| POST | `/api/stock-allocations/bulk` | Bulk allocate stock |
| POST | `/api/stock-allocations/recall` | Recall stock from user |
| POST | `/api/stock-allocations/bulk-recall` | Bulk recall stock |

### Sales
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sales` | List all sales |
| GET | `/api/sales/:id` | Get sale by ID |
| POST | `/api/sales` | Create sale |
| GET | `/api/sales/:id/receipt` | Get sale receipt |

### Commissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/commissions` | List all commissions |
| GET | `/api/commissions/my` | Get my commissions |
| PUT | `/api/commissions/:id/approve` | Approve commission |
| PUT | `/api/commissions/:id/pay` | Mark commission as paid |
| PUT | `/api/commissions/:id/reject` | Reject commission |
| PUT | `/api/commissions/bulk-approve` | Bulk approve commissions |
| PUT | `/api/commissions/bulk-pay` | Bulk pay commissions |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Get dashboard statistics |
| GET | `/api/dashboard/sales-chart` | Get sales chart data |
| GET | `/api/dashboard/top-sellers` | Get top sellers |
| GET | `/api/dashboard/region-stats` | Get regional statistics |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/sales` | Get sales report |
| GET | `/api/reports/commissions` | Get commissions report |
| GET | `/api/reports/inventory` | Get inventory report |
| GET | `/api/reports/reconciliation` | Get reconciliation report |

---

## Stock Workflow

The system supports a hierarchical stock allocation workflow:

```
Admin (Central Stock)
    ↓ allocate
Regional Manager
    ↓ allocate
Team Leader
    ↓ allocate
Field Officer → Sale to Customer
```

### Stock Recall Flow

Stock can be recalled back up the hierarchy:

```
Field Officer
    ↑ recall
Team Leader
    ↑ recall
Regional Manager
    ↑ recall
Admin (Back to Central Stock)
```

### Role Permissions for Stock

| Role | Can Allocate To | Can Recall From |
|------|-----------------|-----------------|
| Admin | Regional Managers | RM, TL, FO (any) |
| Regional Manager | Team Leaders (same region) | TL, FO (same region) |
| Team Leader | Field Officers (own team) | FO (own team) |
| Field Officer | - | - |

---

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── constants.js      # App constants and enums
│   │   └── database.js       # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── commission.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── imei.controller.js
│   │   ├── product.controller.js
│   │   ├── report.controller.js
│   │   ├── sale.controller.js
│   │   ├── stockAllocation.controller.js
│   │   └── user.controller.js
│   ├── middlewares/
│   │   ├── activityLogger.js  # Activity logging
│   │   ├── auth.js            # JWT authentication
│   │   ├── errorHandler.js    # Error handling
│   │   └── validation.js      # Request validation
│   ├── models/
│   │   ├── ActivityLog.js
│   │   ├── Commission.js
│   │   ├── IMEI.js
│   │   ├── Product.js
│   │   ├── Sale.js
│   │   ├── StockAllocation.js
│   │   ├── User.js
│   │   └── index.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── commission.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── imei.routes.js
│   │   ├── product.routes.js
│   │   ├── report.routes.js
│   │   ├── sale.routes.js
│   │   ├── stockAllocation.routes.js
│   │   └── user.routes.js
│   └── index.js               # App entry point
├── .env.example
├── package.json
└── README.md
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment (development/production) | development |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/finetech_pos |
| `JWT_SECRET` | Secret key for JWT tokens | (required) |
| `JWT_EXPIRES_IN` | JWT token expiration | 7d |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:5173 |

---

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongod`
- Check connection string in `.env`
- For Atlas: Whitelist your IP address

### CORS Errors
- Ensure `CORS_ORIGIN` matches your frontend URL
- Include protocol (http:// or https://)

### JWT Token Issues
- Ensure `JWT_SECRET` is set and consistent
- Check token expiration settings