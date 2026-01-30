# Reports Real-Time Data Integration - Quick Reference

## What Changed?

### Before (Mock Data)
```typescript
const { sales, commissions, imeis, products, users, currentUser } = useApp();
// All data from AppContext (static mock data)
```

### After (Real Database)
```typescript
const [reportData, setReportData] = useState<ReportData>({
  sales: [],
  commissions: [],
  users: [],
  products: [],
  imeis: [],
  loading: true,
  error: null,
});

// Data fetched from MongoDB via API calls
```

---

## Data Flow

```
1. User changes date range
   ↓
2. useEffect triggered
   ↓
3. 5 parallel API calls:
   - GET /api/sales?startDate=2024-01-20&endDate=2024-01-26
   - GET /api/commissions?startDate=2024-01-20&endDate=2024-01-26
   - GET /api/users
   - GET /api/products?limit=100
   - GET /api/imei?limit=100
   ↓
4. All data returned & stored in reportData state
   ↓
5. useMemo recalculates:
   - filteredSales (by region)
   - totalRevenue, totalSalesCount
   - topProducts, foPerformance
   - companyPerformance, inventoryMetrics
   ↓
6. Charts & cards render with live data
```

---

## Real-Time Metrics Calculated

| Metric | Source | Calculation |
|--------|--------|-------------|
| Total Revenue | sales | SUM(saleAmount) |
| Total Sales | sales | COUNT(*) |
| Commissions Paid | commissions | SUM(amount WHERE status='paid') |
| Active FOs | users | COUNT(WHERE role='field_officer') |
| Top Products | sales | GROUP BY productId, SUM(saleAmount) |
| FO Performance | sales + commissions | GROUP BY foId, SUM(sales, commissions) |
| Company Split | sales | COUNT BY source (watu/mogo/onfon) |
| Total Stock | imei + products | COUNT(imei WHERE status='IN_STOCK') + SUM(products.stockQuantity) |
| Low Stock | imei | COUNT(WHERE status='IN_STOCK' AND quantity < 5) |

---

## API Endpoints Used

### 1. Sales Data
```
GET /api/sales?startDate=2024-01-20&endDate=2024-01-26&page=1&limit=100
Response: {
  success: true,
  data: [
    {
      id, saleAmount, productId, productName, foId, createdBy, createdAt,
      regionalManagerId, foCode, source, imeiId, paymentMethod, ...
    }
  ],
  total: 245
}
```

### 2. Commissions Data
```
GET /api/commissions?startDate=2024-01-20&endDate=2024-01-26&status=paid
Response: {
  success: true,
  data: [
    {
      id, saleId, amount, status, foId, foName,
      foCommission, teamLeaderCommission, regionalManagerCommission, ...
    }
  ],
  total: 120
}
```

### 3. Users Data
```
GET /api/users?limit=100
Response: {
  success: true,
  data: [
    {
      id, name, email, role, region, phone, foCode,
      regionalManagerId, teamLeaderId, isActive, ...
    }
  ],
  total: 85
}
```

### 4. Products Data
```
GET /api/products?limit=100
Response: {
  success: true,
  data: [
    {
      id, name, category, price, stockQuantity,
      commissionConfig: { foCommission, teamLeaderCommission, regionalManagerCommission }
    }
  ],
  total: 45
}
```

### 5. IMEI/Inventory Data
```
GET /api/imei?status=IN_STOCK&limit=100
Response: {
  success: true,
  data: [
    {
      id, imei, imei2, productId, productName, status,
      quantity, currentHolderId, sellingPrice, ...
    }
  ],
  total: 3456
}
```

---

## Database Collections (MongoDB)

### sales
- Stores all transactions
- Linked to products, users, IMEIs
- **Key Query:** Filter by date range and region

### commissions
- Tracks commission payouts
- Linked to sales and users
- **Key Query:** Filter by date range and status

### users
- Contains all users (admin, RM, TL, FO)
- **Key Query:** Filter by role and region

### products
- Product catalog with pricing
- Commission configuration included
- **Key Query:** Filter by category

### imei
- Individual phone IMEI tracking
- Stock level management
- **Key Query:** Filter by status (IN_STOCK/ALLOCATED/SOLD)

---

## Regions Supported

From `src/lib/excelExport.ts`:
```typescript
export const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
```

**Filtering Logic:**
- **Admin:** Can select any combination of regions
- **Regional Manager:** Locked to their assigned region only
- **Team Leader/FO:** No report access

---

## Loading & Error States

### Loading
```
[Spinner] Loading report data...
```

### Error
```
[Alert Icon] Error Loading Reports
Failed to connect to server. Please check your connection.
[Retry Button]
```

### No Access
```
[Lock Icon] Access Restricted
Only Admin and Regional Managers can generate and view reports.
```

---

## Key Code Sections

### 1. Initialize State
```typescript
const [reportData, setReportData] = useState<ReportData>({
  sales: [],
  commissions: [],
  users: [],
  products: [],
  imeis: [],
  loading: true,
  error: null,
});
```

### 2. Fetch Data
```typescript
useEffect(() => {
  const fetchReportData = async () => {
    try {
      setReportData(prev => ({ ...prev, loading: true, error: null }));

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const [salesRes, commissionsRes, usersRes, productsRes, imeiRes] = await Promise.all([
        salesApi.getAll({ startDate: startDateStr, endDate: endDateStr }),
        commissionsApi.getAll({ startDate: startDateStr, endDate: endDateStr }),
        usersApi.getAll(),
        productsApi.getAll({ limit: 100 }),
        imeiApi.getAll({ limit: 100 })
      ]);

      setReportData({
        sales: salesRes.data || [],
        commissions: commissionsRes.data || [],
        users: usersRes.data || [],
        products: productsRes.data || [],
        imeis: imeiRes.data || [],
        loading: false,
        error: null,
      });
    } catch (error) {
      setReportData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch',
      }));
    }
  };

  if (canGenerateReports) {
    fetchReportData();
  }
}, [startDate, endDate, canGenerateReports]);
```

### 3. Filter by Region
```typescript
const filteredSales = useMemo(() => {
  const regionsToFilter = userRegion ? [userRegion] : selectedRegions;
  const regionUserIds = reportData.users
    .filter(u => regionsToFilter.includes(u.region || ''))
    .map(u => u.id);
  
  return reportData.sales.filter(sale => {
    const isRegionSale = 
      (sale.regionalManagerId && regionUserIds.includes(sale.regionalManagerId)) ||
      (sale.foId && regionUserIds.includes(sale.foId)) ||
      regionUserIds.includes(sale.createdBy);
    return isRegionSale;
  });
}, [reportData.sales, reportData.users, selectedRegions, userRegion]);
```

### 4. Calculate Metrics
```typescript
const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.saleAmount || 0), 0);
const totalSalesCount = filteredSales.length;
const activeFOs = reportData.users.filter(u => u.role === 'field_officer').length;
```

---

## Environment Setup

### Required in .env
```
VITE_API_URL=http://localhost:5000/api
```

### For Production
```
VITE_API_URL=https://api.yourcompany.com/api
```

---

## Testing the Integration

### 1. Check Network Requests
Open DevTools → Network tab
Look for these API calls:
- `GET /api/sales?startDate=...&endDate=...`
- `GET /api/commissions?startDate=...&endDate=...`
- `GET /api/users`
- `GET /api/products`
- `GET /api/imei`

### 2. Verify Data in Console
```javascript
// In browser console
localStorage.getItem('auth_token')  // Should exist
fetch('http://localhost:5000/api/sales')  // Should return data
```

### 3. Test Scenarios
- [ ] Load page as Admin - should see all regions
- [ ] Load page as Regional Manager - should see only their region
- [ ] Change date range - should refetch data
- [ ] Click "Select All" regions - should update chart
- [ ] Export to Excel - should export real data
- [ ] Print report - should print real data
- [ ] Network offline - should show error state

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Data not showing | Check if backend is running on port 5000 |
| "Network error" | Verify VITE_API_URL in .env |
| Charts empty | Check browser console for fetch errors |
| Commission totals wrong | Verify commission records linked to sales |
| Region filtering broken | Ensure users have region field in DB |
| Slow loading | Add limit parameter to API calls |

---

## Performance Notes

- **Parallel Fetching:** All 5 API calls made simultaneously with `Promise.all()`
- **Memoized Calculations:** Only recalculate when dependencies change
- **Pagination Ready:** All endpoints support page/limit parameters
- **Lazy Loading:** Products/IMEIs support limit=100 for chunking

---

## Important: Data Persistence

All data is **persisted in MongoDB**:
- Sales saved to `sales` collection
- Commissions saved to `commissions` collection
- Users saved to `users` collection
- Products saved to `products` collection
- IMEIs saved to `imei` collection

**No data is lost** - reports pull live data from DB each time.

---

## Next Steps

1. ✅ Replace mock data with API calls
2. ✅ Add loading/error states
3. ✅ Test with real backend
4. ⬜ Add caching for performance
5. ⬜ Implement WebSocket for real-time updates
6. ⬜ Add more advanced filtering options
7. ⬜ Create scheduled email reports

---

**Last Updated:** January 26, 2026
**Component:** Reports.tsx (src/pages/)
**Status:** ✅ Production Ready
