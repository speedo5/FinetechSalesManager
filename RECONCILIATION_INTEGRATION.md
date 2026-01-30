# Reconciliation Module - API Integration Summary

## Overview
The Reconciliation page has been successfully modernized to fetch real-time data from backend APIs instead of using mock data. This enables live tracking of sales, inventory, and commission reconciliation across all phone sources (Watu, Mogo, Onfon).

## Changes Made

### 1. Real-Time Data Fetching
- **Added useEffect hook** that automatically fetches reconciliation data on component mount
- **Data sources**: 
  - `salesService.getAll()` - Fetches all sales transactions
  - `imeiService.getAll()` - Fetches all IMEI inventory records
  - `commissionService.getAll()` - Fetches all commission records
- **Auto-refresh**: Data automatically refreshes every 30 seconds for real-time updates
- **Manual refresh**: Users can click the "Refresh" button to fetch latest data immediately

### 2. Company-wise Revenue Calculation
The system now calculates revenue dynamically for each phone source:

```tsx
const companyBreakdown = {
  watu: {
    sales: sales.filter(s => s.source === 'watu' || getSaleSource(s.imei) === 'watu'),
    imeis: imeis.filter(i => i.source === 'watu'),
  },
  mogo: { /* ... */ },
  onfon: { /* ... */ }
};
```

**For each company, displays**:
- **Revenue**: Total sales amount (Ksh)
- **Sales**: Number of transactions
- **Phones Sold**: Count of IMEIs with SOLD status
- **In Stock**: Count of IMEIs with IN_STOCK status

### 3. Real-Time Performance Metrics
The reconciliation displays live metrics including:

| Metric | Source |
|--------|--------|
| Total Sales | Sum of all sale amounts from API |
| Phone Sales | Count of sales with IMEI |
| Accessory Sales | Count of sales without IMEI |
| M-PESA Transactions | Filtered sales by payment method |
| Cash Transactions | Filtered sales by payment method |
| VAT Collected | Total VAT from all sales |
| Total Commissions | Sum of all commissions from API |
| Net Revenue | Total Sales - Total Commissions |

### 4. Live Discrepancy Detection
The system automatically detects and displays the following discrepancies in real-time:

#### Types of Discrepancies:
1. **IMEI Mismatch** (High Severity)
   - IMEI marked as SOLD but no sale record found
   - Alert: Inventory/Sales mismatch

2. **Missing Payment Reference** (Medium Severity)
   - M-PESA sales without payment reference
   - Alert: Payment reconciliation needed

3. **Missing ETR Receipt** (Medium Severity)
   - Sales without ETR receipt number
   - Alert: Tax documentation incomplete

4. **Duplicate IMEI Sales** (High Severity)
   - Same IMEI appearing in multiple sales records
   - Alert: Duplicate transaction detected

#### Discrepancy Display:
- Severity level (High/Medium/Low) with color coding
- Discrepancy type description
- Source/company association
- Filtered view by selected phone source

### 5. Last Updated Timestamp
- Displays exact time of last data refresh
- Updates automatically with each fetch
- Shows in header: "Last updated: HH:MM:SS"

### 6. Loading States
- `isLoading` state prevents duplicate requests
- Refresh button disabled during fetch
- Error handling with toast notifications
- Graceful fallback for empty responses

## Data Flow Architecture

```
Component Mount
    ↓
useEffect Hook Triggered
    ↓
Parallel API Calls
├── salesService.getAll() → Sales[]
├── imeiService.getAll() → IMEI[]
└── commissionService.getAll() → Commission[]
    ↓
Data Extraction & Type Handling
├── Extract sales.sales array
├── Extract imeis.imeis array
└── Extract commissions.commissions array
    ↓
State Update (setSales, setImeis, setCommissions)
    ↓
Component Re-render
├── Calculate Company Breakdown
├── Detect Discrepancies
├── Compute Metrics
└── Display Real-Time Dashboard
    ↓
Auto-Refresh Loop (Every 30 seconds)
```

## UI Enhancements

### Header Section
- Added "Last Updated" timestamp showing real-time status
- Changed "Select Period" button to "Refresh" button for manual data update
- Display shows data freshness for compliance

### Company Breakdown Cards
- Color-coded by source (Watu/Mogo/Onfon)
- Real-time revenue calculations
- Dynamic inventory metrics
- Updates automatically with data refresh

### Reconciliation Status Banner
- ✅ **All Records Reconciled**: Green banner when no discrepancies
- ⚠️ **Discrepancies Found**: Warning banner with count of issues
- Real-time status updates

### Discrepancies Section
- Only displays when discrepancies exist
- Color-coded severity levels
- Source/company filter support
- Detailed descriptions of each issue

## Performance Data Display

### Real-Time Metrics Grid (2x4)
The page displays 8 key performance indicators in a responsive grid:
1. **Total Sales** - Revenue sum with status indicator
2. **Phone Sales** - Unit count
3. **Accessory Sales** - Unit count  
4. **M-PESA Transactions** - Amount and count
5. **Cash Transactions** - Amount and count
6. **VAT Collected** - Total tax amount
7. **Total Commissions** - Outstanding commission balance
8. **Net Revenue** - Bottom line profit

### Detailed Tables
- **Sales by Payment Method**: M-PESA vs Cash breakdown
- **Commission Summary**: Paid vs Pending commissions with amounts

## API Integration Details

### Services Used
```typescript
import { salesService } from '@/services/salesService';
import { commissionService } from '@/services/commissionService';
import { imeiService } from '@/services/imeiService';
```

### Response Types
```typescript
// From salesService
ApiResponse<SalesListResponse> {
  success: boolean;
  data: {
    sales: Sale[];
    total: number;
  };
}

// From imeiService
ApiResponse<IMEIListResponse> {
  success: boolean;
  data: {
    imeis: IMEI[];
  };
}

// From commissionService
ApiResponse<CommissionListResponse> {
  success: boolean;
  data: {
    commissions: Commission[];
  };
}
```

## State Management

### Local Component State
```typescript
const [sales, setSales] = useState<any[]>([]);
const [imeis, setImeis] = useState<any[]>([]);
const [commissions, setCommissions] = useState<any[]>([]);
const [selectedSource, setSelectedSource] = useState<'all' | PhoneSource>('all');
const [isLoading, setIsLoading] = useState(false);
const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
```

### Computed Values (Recalculated on each render)
- `filteredSales` - Sales filtered by selected source
- `companyBreakdown` - Revenue & inventory by company
- `discrepancies` - Auto-detected issues
- `reconciliationItems` - Metrics array for display

## Error Handling

### Network Errors
- Logged to console for debugging
- Toast notification: "Failed to load reconciliation data"
- Component continues to display last known state

### Empty Response Handling
- Checks for arrays before accessing properties
- Gracefully defaults to empty arrays
- Prevents null reference errors

### Data Consistency
- Parallel API calls ensure data consistency
- All three data sources fetched in same request
- Timestamp recorded at completion

## Benefits

1. ✅ **Real-time Data**: Dashboard reflects actual current state
2. ✅ **Automatic Detection**: Issues found immediately without manual audit
3. ✅ **Performance Transparency**: All key metrics visible at a glance
4. ✅ **Compliance**: Detailed discrepancy tracking for audit trails
5. ✅ **Data Persistence**: All data saved to MongoDB automatically
6. ✅ **User-Friendly**: One-click refresh without page reload
7. ✅ **Mobile Responsive**: Dashboard works on all screen sizes

## Testing Checklist

- [ ] Server running on port 5000
- [ ] Refresh button loads data within 2-3 seconds
- [ ] Auto-refresh occurs every 30 seconds
- [ ] Company revenue calculations match backend
- [ ] Discrepancies display correctly
- [ ] Filter by source works for all companies
- [ ] Toast notifications show on error
- [ ] Timestamp updates with each refresh
- [ ] No console errors in developer tools
- [ ] Build completes without errors

## Files Modified

- `src/pages/Reconciliation.tsx` - Main component updated with API integration

## Future Enhancements

1. **Date Range Filtering**: Add calendar picker for specific period reconciliation
2. **Export Functionality**: Export reconciliation report to PDF/Excel
3. **Advanced Analytics**: Trend analysis and forecasting
4. **Webhook Integration**: Real-time updates via WebSocket
5. **Custom Alerts**: Configure thresholds for automatic alerts
6. **Audit Logs**: Detailed tracking of all discrepancy resolutions

## Notes

- Auto-refresh interval can be adjusted in the useEffect hook (currently 30 seconds)
- Response data structure automatically handles variations in API responses
- All calculations use backend data - no mock calculations
- UI layout preserved - only data source changed
