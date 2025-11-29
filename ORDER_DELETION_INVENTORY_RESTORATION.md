# Order Deletion - Inventory Restoration Guide

## What Happens When You Delete Order #27?

### ✅ **Inventory WILL BE RESTORED Automatically**

When you delete Order #27, the system will automatically restore the inventory for all components that were in the order.

---

## Step-by-Step Process

### 1. **Inventory Restoration** (Before Deletion)
   - The system calls `restoreOrderInventory()` function
   - For each component in Order #27:
     - **Restores branch stock** (if branch context exists)
     - **Restores global stock** (as fallback)
     - **Recalculates total stock** from branch sums
     - **Generates stock notifications** (real-time updates)

### 2. **Database Deletion** (After Restoration)
   - Deletes `order_items` records (foreign key constraint)
   - Deletes `orders` record (Order #27)
   - All deletions happen within a database transaction

### 3. **Transaction Safety**
   - If any error occurs during restoration or deletion:
     - **Transaction is rolled back**
     - **No changes are made**
     - Order and inventory remain unchanged

---

## Components in Order #27 That Will Be Restored

Based on the verification, Order #27 contains **8 items**:

1. **AMD Ryzen 7 5700X 3D** - Quantity: 1
2. **GIGABYTE B550M-K - ASF** - Quantity: 1
3. **RX 6600 CHALLENGER 8GB WHITE** - Quantity: 1
4. **XPG SPECTRIX D50 RGB 16GB** - Quantity: 1
5. **2000GB (USED)** - Quantity: 1
6. **MXT-800 LONG FLAT CABLE BLACK 800watts** - Quantity: 1
7. **CH260 BLACK** - Quantity: 1
8. **AK400 - black** - Quantity: 1

### Current Stock Levels (Before Deletion):
- Most components: **19 units** (global stock)
- MXT-800 PSU: **16 units** (global stock)

### After Deletion:
- Each component's stock will be **incremented by the quantity ordered**
- For example:
  - AMD Ryzen 7 5700X: 19 → **20 units** (+1)
  - MXT-800 PSU: 16 → **17 units** (+1)
  - And so on for all 8 components

---

## Code Implementation Details

### Location: `backend/api/orders.php`

#### Function: `handleDeleteOrder()` (lines 772-831)
```php
// Restore inventory before deletion (unless already cancelled/completed)
$currentStatus = strtolower($order['status']);
if ($currentStatus !== 'cancelled' && $currentStatus !== 'canceled') {
    restoreOrderInventory($pdo, $orderId, 'Order deleted by admin');
}

// Delete order items first (due to foreign key constraint)
$stmt = $pdo->prepare("DELETE FROM order_items WHERE order_id = ?");
$stmt->execute([$orderId]);

// Delete order
$stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
$stmt->execute([$orderId]);
```

#### Function: `restoreOrderInventory()` (lines 63-127)
- Restores branch-specific stock (if branch system is active)
- Restores global stock (as fallback)
- Updates both `component_branch_stock` and `components` tables
- Recalculates total stock from branch sums

---

## Database Tables Affected

### 1. **`orders` Table**
   - **Order #27 record will be DELETED**
   - Status: `pending`
   - Total: P42,004.00

### 2. **`order_items` Table**
   - **All 8 order item records will be DELETED**
   - These link Order #27 to the components

### 3. **`components` Table**
   - **Stock quantities will be INCREMENTED** (restored)
   - Each component's `stock_quantity` will increase by the ordered quantity

### 4. **`component_branch_stock` Table** (if branch system is active)
   - **Branch stock will be INCREMENTED** (restored)
   - Bulacan branch stock will increase for each component
   - Total stock is then recalculated from branch sums

---

## Important Notes

### ✅ **Automatic Restoration**
- Inventory restoration happens **automatically** before deletion
- No manual intervention needed
- Works for both branch-specific and global stock systems

### ✅ **Transaction Safety**
- All operations happen within a database transaction
- If restoration or deletion fails, everything is rolled back
- No partial updates or data corruption

### ✅ **Status Check**
- Only restores inventory if order status is NOT already "cancelled" or "canceled"
- Prevents double restoration if order was already cancelled

### ⚠️ **Permissions Required**
- Only **Admin** or **Super Admin** can delete orders
- Regular users cannot delete orders (only cancel their own orders)

---

## Example: What Happens to Each Component

**Before Deletion:**
```
Component: AMD Ryzen 7 5700X 3D
- Global Stock: 19 units
- Branch Stock (Bulacan): 19 units
- Branch Stock (Marikina): 0 units
```

**After Deletion:**
```
Component: AMD Ryzen 7 5700X 3D
- Global Stock: 20 units (+1)
- Branch Stock (Bulacan): 20 units (+1)
- Branch Stock (Marikina): 0 units (unchanged)
```

This pattern repeats for all 8 components in Order #27.

---

## Summary

✅ **Inventory WILL be restored** - All 8 components will have their stock incremented  
✅ **Order WILL be deleted** - Order #27 and its items will be removed from database  
✅ **Transaction is safe** - If anything fails, nothing changes  
✅ **Branch stock is handled** - Both branch-specific and global stock are restored  

**Result:** The inventory that was deducted when Order #27 was created will be added back to the system when you delete it.

