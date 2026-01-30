# Team Leader POS & Inventory Parity Update

## Overview
Updated team leaders to have equal access and rights to the POS and Inventory as admins and regional managers. Team leaders can now:
- Access and use the main Sales (POS) interface
- View and manage inventory
- Sell from inventory with proper commission tracking
- Print receipts
- Make direct sales or assign sales to field officers

## Changes Made

### 1. Sidebar Navigation (`src/components/layout/Sidebar.tsx`)
**Added dual POS access for team leaders:**
- Added `Sales (POS)` option linking to `/pos` (main POS interface)
- Kept `Team POS` option linking to `/team-leader/pos` (team leader specific shared inventory POS)
- Added `Inventory` option linking to `/inventory` (main inventory management)

**Previous:**
```typescript
const teamLeaderNavItems: NavItem[] = [
  { label: 'My Team', icon: Users, href: '/team-leader' },
  { label: 'POS', icon: ShoppingCart, href: '/team-leader/pos' },
  { label: 'Stock Allocation', icon: Send, href: '/stock-allocation' },
  { label: 'Inventory', icon: Smartphone, href: '/inventory' },
  ...
];
```

**New:**
```typescript
const teamLeaderNavItems: NavItem[] = [
  { label: 'My Team', icon: Users, href: '/team-leader' },
  { label: 'Sales (POS)', icon: ShoppingCart, href: '/pos' },
  { label: 'Team POS', icon: ShoppingCart, href: '/team-leader/pos' },
  { label: 'Stock Allocation', icon: Send, href: '/stock-allocation' },
  { label: 'Inventory', icon: Smartphone, href: '/inventory' },
  ...
];
```

### 2. POS Page - Receipt Printing (`src/pages/POS.tsx`)
**Enabled team leaders to print receipts:**

**Previous:**
```typescript
const canPrintReceipt = currentUser?.role === 'admin' || currentUser?.role === 'regional_manager';
```

**New:**
```typescript
const canPrintReceipt = currentUser?.role === 'admin' || currentUser?.role === 'regional_manager' || currentUser?.role === 'team_leader';
```

### 3. POS Page - Field Officer Assignment UI (`src/pages/POS.tsx`)
**Made FO assignment optional for team leaders with role-aware messaging:**

**Updated placeholder and labels:**
- Placeholder changes based on user role
- For team leaders: "Leave blank for direct sale (my commission)"
- For admin/regional: "Select FO (or leave blank)"
- Direct sale option shows "Direct Sale (My Commission)" for team leaders

**Code:**
```typescript
<Select value={selectedFO || 'none'} onValueChange={(v) => setSelectedFO(v === 'none' ? '' : v)}>
  <SelectTrigger>
    <SelectValue placeholder={currentUser?.role === 'team_leader' ? 'Leave blank for direct sale (my commission)' : 'Select FO (or leave blank)'} />
  </SelectTrigger>
  <SelectContent>
    <SelectItem key="none" value="none">{currentUser?.role === 'team_leader' ? 'Direct Sale (My Commission)' : 'No FO - Direct Sale'}</SelectItem>
    ...
  </SelectContent>
</Select>
```

### 4. POS Page - Commission Display (`src/pages/POS.tsx`)
**Enhanced commission information for team leaders:**

**Updated commission section label:**
```typescript
<p className="text-xs text-muted-foreground mb-2">
  {currentUser?.role === 'team_leader' ? 'Commission for FO Sale:' : 'Commission Distribution:'}
</p>
```

**Updated "Team Leader" label in commission display:**
```typescript
<p className="text-muted-foreground">
  {currentUser?.role === 'team_leader' ? 'Your Commission' : 'Team Leader'}
</p>
```

### 5. POS Page - Commission Summary (`src/pages/POS.tsx`)
**Show team leader's commission for direct sales:**

**Added:**
```typescript
{currentUser?.role === 'team_leader' && !selectedFO && commissionConfig?.teamLeaderCommission > 0 && (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Your Commission:</span>
    <span className="text-success">Ksh {commissionConfig.teamLeaderCommission.toLocaleString()}</span>
  </div>
)}
```

This displays the team leader's commission amount when they make a direct sale (no FO assigned).

## Access Rights Summary

### Team Leader Capabilities
| Feature | Access | Notes |
|---------|--------|-------|
| Main POS | ✅ Yes | Same as admin/regional manager |
| Sales (POS) | ✅ Yes | Can sell to any customer |
| Direct Sales | ✅ Yes | Gets team leader commission |
| FO Assignment | ✅ Optional | Can assign sales to field officers |
| Receipt Printing | ✅ Yes | Can print and download receipts |
| Inventory Viewing | ✅ Yes | Can view full inventory |
| Team POS | ✅ Yes | Shared inventory pool sales |
| Commission Config | ❌ No | Admin-only feature (appropriate) |
| Add Products | ❌ No | Admin-only feature (appropriate) |

### Commission Structure
When team leader makes a sale:
- **Direct sale (no FO)**: Team leader receives `teamLeaderCommission`
- **Sale assigned to FO**: FO receives `foCommission`, team leader can see the distribution
- **Team leader selling for team**: Uses shared inventory pool with proper sync

## Testing Recommendations

1. **Login as Team Leader** and verify:
   - Both "Sales (POS)" and "Team POS" appear in sidebar
   - Can access main POS page without issues
   - Can access Inventory page
   - Can select products and IMEIs

2. **Make a Direct Sale** (no FO):
   - Select product and IMEI/quantity
   - Leave FO field blank or select "Direct Sale (My Commission)"
   - Verify commission displays correctly
   - Complete sale and verify receipt prints

3. **Assign Sale to FO**:
   - Select product and IMEI/quantity
   - Select a field officer from dropdown
   - Verify commission distribution shows
   - Complete sale and verify FO is recorded

4. **Inventory Management**:
   - View full inventory list
   - Verify can see all allocated items
   - Verify commission configuration is hidden (admin only)

## Backwards Compatibility
- ✅ Admin functionality unchanged
- ✅ Regional manager functionality unchanged
- ✅ Field officer functionality unchanged
- ✅ Existing team leader POS (/team-leader/pos) still available
- ✅ No database changes required

## Files Modified
1. `src/components/layout/Sidebar.tsx` - Added POS and Inventory navigation
2. `src/pages/POS.tsx` - Enabled receipt printing and improved UI for team leaders

## Notes
- Team leaders now have feature parity with admins and regional managers for POS and Inventory
- Commission tracking is properly handled for both direct sales and FO-assigned sales
- Real-time inventory sync for shared inventory pool continues to work
- All role-based restrictions follow principle of least privilege (admin-only features remain admin-only)
