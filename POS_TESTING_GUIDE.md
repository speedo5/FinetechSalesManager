# POS Module Testing Guide

## Quick Verification Steps

### 1. Start the Application
```bash
# Frontend (in workspace root)
npm run dev

# Backend (in server folder)
cd server
npm start
```

### 2. Navigate to POS Page
- URL: `http://localhost:5173/app/pos` (or when deployed)
- Should see "Point of Sale" header
- Loading spinner while fetching data

### 3. Verify Products Load from API
✓ Products list should display from MongoDB
✓ Categories filter should show: Smartphones, Feature Phones, Tablets, Accessories, SIM Cards, Airtime
✓ Can filter by category
✓ Stock quantities display (from IMEI count for phones)

### 4. Select a Product
✓ Click any phone product
✓ Should see it highlighted
✓ IMEI selection panel appears below

### 5. Select an IMEI (if Phone)
✓ IMEI list loads (only IN_STOCK status)
✓ Can search IMEIs
✓ Selected IMEI shows in order summary

### 6. Complete a Sale
✓ Fill client details (Name, Phone, ID)
✓ Select payment method
✓ Click "Complete Sale"
✓ Button shows "Processing..." state
✓ Success notification appears

### 7. Verify Database Persistence
✓ MongoDB - Sales collection has new record
✓ MongoDB - IMEI status changed to 'sold'
✓ MongoDB - Commission records created for FO/TL/RM
✓ MongoDB - Activity log entry created

### 8. Refresh Page
✓ Page reloads
✓ Data persists (not lost)
✓ Sold IMEI no longer available in list
✓ Sale history preserved

## Expected Database Changes

### After Sale Creation:

**Sales Collection:**
```json
{
  "_id": ObjectId(...),
  "imeiId": "imei-123",
  "productId": "prod-456",
  "quantity": 1,
  "paymentMethod": "Cash",
  "customerName": "John Doe",
  "customerPhone": "+254712345678",
  "saleAmount": 35000,
  "createdBy": "user-id",
  "createdAt": ISODate("2024-01-15T10:30:00Z")
}
```

**IMEI Document:**
```json
{
  "_id": ObjectId(...),
  "imei": "123456789012345",
  "status": "sold",        // Changed from "in_stock"
  "soldAt": ISODate(...),
  "saleId": "sale-id",
  "productId": "prod-456"
}
```

**Commission Collection:**
```json
[
  {
    "_id": ObjectId(...),
    "saleId": "sale-id",
    "userId": "fo-user-id",
    "role": "field_officer",
    "amount": 5000,
    "status": "pending",
    "createdAt": ISODate(...)
  },
  {
    "_id": ObjectId(...),
    "saleId": "sale-id",
    "userId": "tl-user-id",
    "role": "team_leader",
    "amount": 3000,
    "status": "pending",
    "createdAt": ISODate(...)
  }
]
```

## API Calls Made by POS

### On Page Load:
```
GET /api/products
GET /api/imei
```

### On Sale Completion:
```
POST /api/sales
  ├→ Saves Sale
  ├→ Updates IMEI status
  └→ Creates Commissions

GET /api/imei (refresh)
  └→ Updates local IMEI list
```

## Troubleshooting

### Products Don't Load
- Check backend is running on port 5000
- Verify `/api/products` endpoint works: `curl http://localhost:5000/api/products`
- Check browser console for API errors
- Verify MongoDB connection in backend logs

### IMEI List Empty
- Ensure IMEIs exist in MongoDB with status `in_stock`
- Verify product matching: IMEI.productId === selected product.id
- Check backend `/api/imei` returns data

### Sale Won't Complete
- Check all required fields are filled (client name, payment method)
- Verify backend `/api/sales` endpoint is working
- Check browser console for errors
- Verify selectedImeiData has an `id` property (not just `imei`)

### IMEI Status Not Updating
- Backend should return updated IMEI status
- Check MongoDB IMEI document - `status` field should be 'sold'
- If not updating, backend POST /sales may not be setting status correctly

### Receipt Won't Generate
- Check canPrintReceipt = currentUser.role is 'admin' or 'regional_manager'
- Verify generateSaleReceipt function in `/lib/pdfGenerator.ts`
- Check browser console for PDF generation errors

## Success Indicators

✅ Products load from MongoDB on page open
✅ Category filter works with new categories
✅ IMEIs load for selected product
✅ Sale creates without errors
✅ Success toast notification appears
✅ Form resets after successful sale
✅ Page refresh preserves data
✅ MongoDB shows new Sale record
✅ IMEI status changed to 'sold' in database
✅ Commission records created for hierarchy
✅ Receipt PDF generated (for admin/RM)

## Performance Notes

- Products/IMEIs loaded on mount (consider pagination for large datasets)
- Category filter is client-side (instant)
- Sale creation is async (shows "Processing..." state)
- IMEI refresh is optimized (only on phone sales)

## Common Scenarios

### Scenario 1: Sell a Smartphone
1. Load POS page
2. Filter: "Smartphones"
3. Select iPhone 15
4. Select an available IMEI
5. Enter client details
6. Select Cash payment
7. Click Complete Sale
8. Receipt PDF downloads
9. Check MongoDB: IMEI status = 'sold', Commission records exist

### Scenario 2: Sell Accessories (No IMEI)
1. Load POS page
2. Filter: "Accessories"
3. Select SIM Card pack
4. Set quantity
5. Enter client details
6. Click Complete Sale
7. No IMEI selection needed
8. Sale records in MongoDB

### Scenario 3: Verify Data Persistence
1. Complete a sale
2. Refresh page (Ctrl+R)
3. Check MongoDB sales collection
4. Data should still exist
5. Sold IMEI no longer available in list

## Next Steps

1. ✅ Test in development environment
2. ✅ Verify MongoDB has all data
3. ✅ Check receipt PDF generation
4. ✅ Test error scenarios
5. ✅ Deploy to production
6. ✅ Monitor sales transactions
7. Consider implementing:
   - Sales history view
   - Receipt search/reprint
   - Inventory reconciliation
   - Commission payouts
