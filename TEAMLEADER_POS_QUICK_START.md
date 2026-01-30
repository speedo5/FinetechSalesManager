# Team Leader POS - Shared Inventory System: Quick Start

## What's New?

Team leaders can now **sell from the same shared inventory pool as the admin** with real-time synchronization.

---

## 🚀 Quick Features

### Automatic Sync
- Inventory updates **every 3 seconds**
- Syncs when you **switch browser tabs**
- **Manual sync button** for immediate refresh

### Shared Inventory Pool
- See **same items** as Admin POS
- **Can't double-sell** (inventory locking)
- **Real-time updates** across all POS systems

### Visual Status
```
🟢 Synced     = Inventory is up-to-date
⚡ Syncing... = Fetching latest inventory
Last sync: 2:45:23 PM
```

---

## 👥 For Team Leaders

### How to Use

1. **Open Team Leader POS**
   - Inventory automatically loads from shared pool
   - Shows items allocated to your team

2. **Select Product to Sell**
   - See "X in pool" (not just your team's stock)
   - Count updates in real-time

3. **Select IMEI**
   - Only unlocked items shown
   - Item is locked while you're selling it

4. **Complete Sale**
   - Item locked during sale (prevents double-selling)
   - Sale synced to all POS systems
   - Item automatically removed from Admin POS too

5. **Check Sync Status**
   - Green indicator = All synced
   - Click "Manual Sync" to refresh immediately

---

## 🔄 Real-Time Sync Examples

### Scenario 1: Admin Sells Item
```
Admin POS: Sells iPhone 15
         ↓ (3-second sync)
Team Leader POS: iPhone 15 disappears from inventory
         ↓
Status: Shows "Synced" with green indicator
```

### Scenario 2: Multiple Team Leaders
```
Team Leader 1: Starts selling Galaxy S24
              ↓ (Item locked)
Team Leader 2: Sees Galaxy S24 as unavailable
              ↓
Team Leader 1: Completes sale
              ↓ (Item broadcast as sold)
Team Leader 2: Item removed from inventory
              ↓
Admin: Item removed and marked SOLD
```

### Scenario 3: Network Issue
```
Sync fails:
  ↓
Automatic retry every 3 seconds
  ↓
Connection restored:
  ↓
Inventory automatically syncs
```

---

## ⚙️ Configuration (For Developers)

**Default Settings**:
```typescript
{
  enableRealTimeSync: true,    // Always on
  pollIntervalMs: 3000,        // Sync every 3 seconds
  enableLocking: true,         // Prevent double-selling
  syncOnFocus: true,           // Sync when tab gains focus
}
```

**To change sync interval**:
```typescript
inventoryRealtimeSyncService.updateConfig({
  pollIntervalMs: 5000  // Change to 5 seconds
});
```

---

## 🛠 Troubleshooting

| Issue | Solution |
|-------|----------|
| Inventory not updating | Click "Manual Sync" button |
| Item appears to be locked | Wait 60 seconds, it auto-expires |
| Seeing old inventory | Refresh page (F5) |
| Can't select item | Another user may be selling it |
| Sync keeps failing | Check network connection |

---

## 📊 How Inventory Locking Works

```
Step 1: You select IMEI to sell
         ↓
Step 2: System locks the IMEI
         ↓ (If lock fails → show error "Item being sold by someone else")
         ↓
Step 3: Sale completes
         ↓
Step 4: IMEI marked as SOLD and removed from all systems
         ↓
OR if sale fails:
         ↓
Step 4: IMEI automatically unlocked and available again
```

---

## 🎯 Key Differences from Old System

| Before | After |
|--------|-------|
| Saw only team's allocated stock | See entire shared pool |
| Delays before items marked sold | Real-time sold status |
| Could double-sell in race condition | Inventory locking prevents this |
| Manual inventory refresh needed | Auto-sync every 3 seconds |
| No sync status visibility | Clear status indicator |

---

## 💡 Tips for Best Results

1. **Keep browser tab visible** during sales for instant updates
2. **Click Manual Sync** if you notice delayed updates
3. **Check sync indicator** before completing large sale
4. **Note the "in pool" count** - shows shared inventory availability

---

## 🔗 Related Documentation

- [Full Technical Documentation](TEAMLEADER_POS_REALTIME_SYNC.md)
- [Implementation Details](TEAMLEADER_POS_SYNC_IMPLEMENTATION.md)

---

## ✅ Testing Checklist

- [ ] Open Team Leader and Admin POS side-by-side
- [ ] Sell item in Admin → Check it disappears from TL POS
- [ ] Sell item in TL POS → Check it disappears from Admin
- [ ] Check sync indicator updates
- [ ] Click "Manual Sync" → Verify inventory refreshes
- [ ] Switch browser tabs → Should auto-sync on return
- [ ] Try selecting item → Should show "X in pool"

---

**Status**: ✅ Ready to use  
**Last Updated**: January 27, 2026
