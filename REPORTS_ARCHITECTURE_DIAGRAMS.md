# Reports Integration - Visual Architecture & Data Flow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REPORTS PAGE (React)                          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ State Management                                             │  │
│  │ ┌────────────────────────────────────────────────────────┐  │  │
│  │ │ const [reportData, setReportData] = useState({         │  │  │
│  │ │   sales: [],          // Real from DB                  │  │  │
│  │ │   commissions: [],    // Real from DB                  │  │  │
│  │ │   users: [],          // Real from DB                  │  │  │
│  │ │   products: [],       // Real from DB                  │  │  │
│  │ │   imeis: [],          // Real from DB                  │  │  │
│  │ │   loading: true,                                       │  │  │
│  │ │   error: null                                          │  │  │
│  │ │ })                                                      │  │  │
│  │ └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ useEffect Hook (Triggered on date change)                   │  │
│  │                                                               │  │
│  │  ┌─────────┬──────────┬───────┬──────────┬────────┐         │  │
│  │  ↓         ↓          ↓       ↓          ↓        ↓         │  │
│  │ Sales   Commissions Users  Products   IMEIs  (Parallel)   │  │
│  │ API      API         API     API        API   (Promise.all)│  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Calculations (useMemo - Cached)                             │  │
│  │ ├─ filteredSales (by region)                               │  │
│  │ ├─ totalRevenue (SUM of saleAmount)                        │  │
│  │ ├─ topProducts (GROUP BY productId)                        │  │
│  │ ├─ foPerformance (GROUP BY foId)                           │  │
│  │ ├─ companyPerformance (COUNT by source)                    │  │
│  │ └─ inventoryMetrics (COUNT, SUM)                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ UI Rendering                                                 │  │
│  │ ├─ Stats Cards (Revenue, Sales, Commissions, FOs)          │  │
│  │ ├─ Top Products Bar Chart                                   │  │
│  │ ├─ FO Performance Chart                                     │  │
│  │ ├─ Company Performance Pie Chart                            │  │
│  │ └─ Inventory Summary Grid                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    API LAYER (src/lib/api.ts)                        │
│                                                                       │
│  • Authorization header (Bearer token)                               │
│  • Base URL: http://localhost:5000/api                              │
│  • Error handling & retry logic                                     │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│               BACKEND SERVER (Node.js/Express)                       │
│                                                                       │
│  Routes:                                                             │
│  • GET /api/sales?startDate=&endDate=                               │
│  • GET /api/commissions?startDate=&endDate=                         │
│  • GET /api/users                                                   │
│  • GET /api/products                                                │
│  • GET /api/imei                                                    │
└─────────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    MONGODB DATABASE                                   │
│                                                                       │
│  Collections:                                                        │
│  ├─ sales (Product sales transactions)                              │
│  ├─ commissions (Commission payments)                               │
│  ├─ users (User accounts & roles)                                   │
│  ├─ products (Product catalog)                                      │
│  └─ imei (Phone inventory tracking)                                 │
│                                                                       │
│  Indexes:                                                            │
│  ├─ sales.createdAt (for date filtering)                            │
│  ├─ sales.foId (for FO filtering)                                   │
│  ├─ users.region (for region filtering)                             │
│  ├─ commissions.status (for status filtering)                       │
│  └─ imei.status (for inventory filtering)                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Sequence Diagram

```
User Opens Reports Page
    │
    ├─→ Check Permissions (currentUser.role)
    │   ├─ "admin" or "regional_manager" → Continue
    │   └─ Other roles → Show "Access Restricted"
    │
    └─→ useEffect Triggered (startDate, endDate, canGenerateReports)
        │
        ├─→ Show Loading State
        │   [Spinner Icon] Loading report data...
        │
        └─→ Parallel API Calls (Promise.all)
            │
            ├─→ API 1: GET /api/sales?startDate=2024-01-20&endDate=2024-01-26
            │   └─ Response: { success: true, data: [...], total: 245 }
            │
            ├─→ API 2: GET /api/commissions?startDate=2024-01-20&endDate=2024-01-26
            │   └─ Response: { success: true, data: [...], total: 120 }
            │
            ├─→ API 3: GET /api/users
            │   └─ Response: { success: true, data: [...], total: 85 }
            │
            ├─→ API 4: GET /api/products?limit=100
            │   └─ Response: { success: true, data: [...], total: 45 }
            │
            └─→ API 5: GET /api/imei?limit=100
                └─ Response: { success: true, data: [...], total: 3456 }
                    │
                    └─→ All 5 responses received (~200ms total)
                        │
                        ├─→ Store in reportData state
                        │   {
                        │     sales: [245 items],
                        │     commissions: [120 items],
                        │     users: [85 items],
                        │     products: [45 items],
                        │     imeis: [3456 items],
                        │     loading: false,
                        │     error: null
                        │   }
                        │
                        └─→ Trigger useMemo Calculations
                            │
                            ├─ Calculate: totalRevenue = SUM(sales.saleAmount)
                            ├─ Calculate: totalSalesCount = COUNT(sales)
                            ├─ Calculate: totalCommissionsPaid = SUM(commissions.amount)
                            ├─ Calculate: topProducts = GROUP BY productId
                            ├─ Calculate: foPerformance = GROUP BY foId
                            ├─ Calculate: companyPerformance = GROUP BY source
                            └─ Calculate: inventoryMetrics = COUNT, SUM
                                │
                                └─→ Render UI with Real Data
                                    ├─ Stats Cards
                                    ├─ Bar Charts
                                    ├─ Pie Chart
                                    └─ Tables
                                        │
                                        └─→ Reports Page Complete ✓
```

---

## Region-Based Filtering Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User Type Determines Region Access                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ADMIN USER                                                   │
│ ├─ currentUser.region = null                                │
│ ├─ Can select multiple regions                              │
│ ├─ Show checkboxes: [North] [South] [East] [West] [Central]│
│ └─ Default: All regions selected                            │
│                                                               │
│ REGIONAL MANAGER                                             │
│ ├─ currentUser.region = "North" (assigned)                  │
│ ├─ Cannot change region selection                           │
│ ├─ Show locked view: "Viewing: North Region"                │
│ └─ Filter only applies to their region                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Filter Logic Applied to Sales Data                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Selected Regions → "North", "East"                           │
│         ↓                                                     │
│ Get User IDs from region:                                   │
│   regionUserIds = users                                      │
│     .filter(u => ["North", "East"].includes(u.region))      │
│     .map(u => u.id)                                          │
│   → [user1.id, user3.id, user5.id, ...]                     │
│         ↓                                                     │
│ Filter sales where FO is in region:                         │
│   filteredSales = sales.filter(sale =>                      │
│     regionUserIds.includes(sale.foId) ||                    │
│     regionUserIds.includes(sale.createdBy)                  │
│   )                                                          │
│   → Only sales from North & East FOs                        │
│         ↓                                                     │
│ All calculations use filteredSales:                          │
│   ├─ totalRevenue = SUM(filteredSales.saleAmount)           │
│   ├─ topProducts = GROUP BY filteredSales.productId         │
│   ├─ foPerformance = GROUP BY filteredSales.foId            │
│   └─ ... all metrics region-specific                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Calculation Pipeline

```
Raw Sales Data (245 records)
    │
    ├─→ TOTAL REVENUE
    │   for each sale in filteredSales:
    │     sum += sale.saleAmount
    │   total = ₹45,678,900
    │
    ├─→ TOTAL SALES COUNT
    │   total = filteredSales.length = 245 transactions
    │
    ├─→ TOP PRODUCTS (Top 5)
    │   Group by productId:
    │   ┌─────────────────────────┬─────────┐
    │   │ Product Name            │ Revenue │
    │   ├─────────────────────────┼─────────┤
    │   │ Samsung Galaxy A05 64GB  │ 8.4M    │
    │   │ Samsung Galaxy A15 128GB │ 7.2M    │
    │   │ Samsung Galaxy A25       │ 6.8M    │
    │   │ Realme 12 Pro            │ 5.9M    │
    │   │ Xiaomi 14                │ 4.3M    │
    │   └─────────────────────────┴─────────┘
    │
    ├─→ FO PERFORMANCE (Top 5)
    │   Group by foId:
    │   ┌──────────┬────────┬──────────────┐
    │   │ FO Name  │ Sales  │ Commissions  │
    │   ├──────────┼────────┼──────────────┤
    │   │ John     │ 2.3M   │ 125,000      │
    │   │ Sarah    │ 1.9M   │ 98,500       │
    │   │ Mike     │ 1.8M   │ 92,300       │
    │   │ Emily    │ 1.5M   │ 78,900       │
    │   │ David    │ 1.2M   │ 62,400       │
    │   └──────────┴────────┴──────────────┘
    │
    ├─→ COMMISSIONS PAID
    │   Filter where status == "paid":
    │   sum = 1,250,000
    │
    ├─→ COMPANY PERFORMANCE
    │   Count by source:
    │   ┌────────┬─────────────┬──────────┐
    │   │Company │ Count       │ %        │
    │   ├────────┼─────────────┼──────────┤
    │   │Watu    │ 110 sales   │ 45%      │
    │   │Mogo    │  85 sales   │ 35%      │
    │   │Onfon   │  50 sales   │ 20%      │
    │   └────────┴─────────────┴──────────┘
    │
    └─→ INVENTORY STATUS
        Group by status:
        ├─ IN_STOCK    = 3,200 units (92%)
        ├─ ALLOCATED   =   200 units (6%)
        ├─ SOLD        =    50 units (2%)
        └─ LOCKED      =     6 units (0.2%)
```

---

## API Call Timeline (Parallel Execution)

```
Time 0ms     Start fetching
  │
  ├─ API 1: /api/sales............ [###############] 45ms ✓
  │
  ├─ API 2: /api/commissions..... [#########] 25ms ✓
  │
  ├─ API 3: /api/users........... [######] 15ms ✓
  │
  ├─ API 4: /api/products........ [#####################] 50ms ✓
  │
  ├─ API 5: /api/imei............ [##############] 40ms ✓
  │
  └──────────────────────────────────────→ Time 50ms
     (Max of all = Total time)

Sequential would take: 45+25+15+50+40 = 175ms
Parallel takes: max(45,25,15,50,40) = 50ms ✓
Savings: 125ms faster!
```

---

## State Machine Diagram

```
                    ┌──────────────────┐
                    │  Page Load Start  │
                    └─────────┬────────┘
                              │
                    ┌─────────▼────────┐
                    │ Check Permission │
                    └────┬─────────────┘
                         │
            ┌────────────┬┴────────────┬──────────────┐
            │            │             │              │
        Can't   Can (Admin)  RM      Can't (FO/TL)
        Access              │         Access
            │               │             │
            ▼               │             ▼
      ┌──────────┐      ┌───▼─────┐  ┌──────────────┐
      │ "Access  │      │ useEffect│  │ "Access      │
      │Restricted"      │ Hook    │  │ Restricted"  │
      └──────────┘      └───┬─────┘  └──────────────┘
                            │
                    ┌───────▼────────┐
                    │  State: Loading│
                    │  loading=true  │
                    │  error=null    │
                    └───────┬────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐      ┌──────▼──────┐
        │ Fetch Success  │      │ Fetch Failed│
        │ All 5 APIs OK  │      │ 1+ APIs err │
        └───────┬────────┘      └──────┬──────┘
                │                      │
        ┌───────▼──────────┐    ┌──────▼────────┐
        │ State: Loaded    │    │ State: Error  │
        │ loading=false    │    │ loading=false │
        │ error=null       │    │ error="text"  │
        │ sales=[...]      │    │               │
        │ commissions=[...]│    │ Show Error UI │
        │ users=[...]      │    │ + Retry Button│
        │ products=[...]   │    └────────┬──────┘
        │ imeis=[...]      │             │
        └───────┬──────────┘        ┌────▼──────┐
                │                   │ User Click│
        ┌───────▼──────────┐       │ Retry     │
        │ Calculate Metrics│       │           │
        │ (useMemo)        │       └─────┬─────┘
        │ ├─totalRevenue   │             │
        │ ├─topProducts    │   ┌─────────▼──┐
        │ ├─foPerformance  │   │ Retry Fetch│
        │ └─...            │   └────┬───────┘
        │                  │        │
        │ ┌────────────────▼──┐     │
        │ │ Render Charts &   │     │
        │ │ UI with Real Data │     │
        │ │ ✓ Reports Complete    │
        │ └───────────────────┘     │
        │                           │
        └───────────────────────────┘
                     │
                     │ (Loop back on date change)
                     │ useEffect triggered again
                     └─→ State: Loading...
```

---

## Database Schema Relationships

```
┌──────────────────┐
│     SALES        │
├──────────────────┤
│ id (PK)          │
│ saleAmount       │
│ productId (FK)   ├──────────┐
│ productName      │          │
│ foId (FK)        ├──┐       │
│ foCode           │  │       │
│ source           │  │       │
│ createdAt        │  │       │
│ createdBy        │  │       │
│ imeiId (FK)      │  │       │
│ ...              │  │       │
└──────────────────┘  │       │
         │            │       │
    ┌────┘            │       │
    │                 │       │
┌───▼──────────────┐  │    ┌──▼─────────────┐
│    COMMISSIONS   │  │    │   PRODUCTS     │
├──────────────────┤  │    ├────────────────┤
│ id (PK)          │  │    │ id (PK)        │
│ saleId (FK)      ├──┼───→│ name           │
│ amount           │  │    │ category       │
│ status           │  │    │ price          │
│ foId (FK)        ├──┼──┐ │ stockQuantity  │
│ foName           │  │  │ │ commissionConfig│
│ createdAt        │  │  │ │ ...            │
│ ...              │  │  │ └────────────────┘
└──────────────────┘  │  │
         │            │  │
         │            │  └──┬──────────────┐
         │            │     │              │
    ┌────▼────────────┼─┐   │    ┌─────────▼────┐
    │      USERS      │ │   │    │     IMEI     │
    ├─────────────────┤ │   │    ├──────────────┤
    │ id (PK)         │ │   │    │ id (PK)      │
    │ name            │ │   │    │ imei         │
    │ role            │ │   │    │ productId(FK)├─┘
    │ region          │ │   │    │ productName  │
    │ foCode          │ │   │    │ status       │
    │ teamLeaderId(FK)├─┼─┐ │    │ quantity     │
    │ regionalMgrId..◄┘ │ │ │    │ ...          │
    │ isActive        │ │ │ │    └──────────────┘
    │ ...             │ │ │ │
    └─────────────────┘ │ │ │
              │         │ │ │
         ┌────┘────┬────┘ │ │
         │         │      │ │
      RM │      TL │      │ │
        │         │      │ │
    (Hierarchy:    └──────┘ │
     FO → TL → RM)          │
                            │
                     (IMEI linked
                      to Product,
                      sold by FO)
```

---

## Error Handling Flow

```
API Call
    │
    ├─ Network Error
    │  ├─ "Failed to fetch"
    │  ├─ "Network connection failed"
    │  └─ "Server unreachable"
    │
    ├─ Auth Error
    │  ├─ "401 Unauthorized"
    │  ├─ "Invalid token"
    │  └─ "Please login again"
    │
    ├─ Validation Error
    │  ├─ "Invalid date range"
    │  ├─ "Missing required field"
    │  └─ "Bad request"
    │
    ├─ Server Error
    │  ├─ "500 Internal server error"
    │  ├─ "Database connection failed"
    │  └─ "Service temporarily unavailable"
    │
    └─ Unknown Error
       └─ "Something went wrong"
            │
            ▼
    Set reportData.error = errorMessage
            │
            ▼
    Show Error UI with message & Retry button
            │
            ▼
    User clicks Retry
            │
            ▼
    Trigger useEffect again
```

---

## Cache & Performance Strategy

```
Fetch Data        Memoize Calculations    Render UI
     │                    │                   │
     ▼                    ▼                   ▼
Store in         Cache using useMemo    Charts & Cards
reportData       (avoid recalc on       Display with
state            unrelated changes)     real data
     │                    │                   │
     │                    │                   │
     └────────────────────┴───────────────────┘
                          │
                ┌─────────▼──────────┐
                │ Date Range Change? │
                └─────────┬──────────┘
                          │
                    ┌─────▴─────┐
                    │           │
                  YES           NO
                    │           │
                    ▼           │
            Re-fetch Data       │
                    │           │
                    └─────┬─────┘
                          │
                          ▼
                    Use cached values
```

---

## UI State Rendering Decision Tree

```
Component Mount
        │
        ▼
Check canGenerateReports?
        │
    ┌───┴───┐
    │       │
   NO      YES
    │       │
    ▼       ▼
  Show   Check
 Access  loading?
Denied   │
         ├─ true → Show Spinner
         │
         └─ false → Check error?
                    │
                    ├─ true → Show Error UI
                    │
                    └─ false → Render Charts
                               with real data ✓
```

---

This architecture ensures:
✅ Real-time data from MongoDB
✅ Fast parallel API calls
✅ Efficient cached calculations
✅ Proper error handling
✅ Region-based filtering
✅ Responsive UI states
✅ Production-ready performance
