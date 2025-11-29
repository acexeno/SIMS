-- ============================================
-- CRITICAL FIX: cart_items table missing AUTO_INCREMENT and PRIMARY KEY
-- ============================================
-- This is why add to cart is failing!
-- The id column doesn't have AUTO_INCREMENT, so inserts fail

-- Step 1: Check current structure
SHOW CREATE TABLE cart_items;
SHOW COLUMNS FROM cart_items WHERE Field = 'id';

-- Step 2: Check if there are any existing records
SELECT COUNT(*) as total_records, MAX(id) as max_id FROM cart_items;

-- Step 3: Delete any invalid records with id = 0
DELETE FROM cart_items WHERE id = 0;

-- Step 4: Fix the id column - Add AUTO_INCREMENT and PRIMARY KEY
-- IMPORTANT: Run this command to fix the table structure
ALTER TABLE cart_items MODIFY id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY;

-- Step 5: Set AUTO_INCREMENT value
-- If table is empty (max_id is NULL or 0):
ALTER TABLE cart_items AUTO_INCREMENT = 1;

-- If you have existing records (max_id is a number, e.g., 5):
-- Replace X with (max_id + 1) from Step 2
-- Example: If max_id is 5, use 6
-- ALTER TABLE cart_items AUTO_INCREMENT = 6;

-- Step 6: Verify the fix
SHOW CREATE TABLE cart_items;
-- Should show: `id` int(11) NOT NULL AUTO_INCREMENT, PRIMARY KEY (`id`)
SHOW COLUMNS FROM cart_items WHERE Field = 'id';
-- Should show: Key = 'PRI', Extra = 'auto_increment'

-- Step 7: Test insert (optional - delete after testing)
-- INSERT INTO cart_items (user_id, component_id, quantity) VALUES (1, 1, 1);
-- SELECT LAST_INSERT_ID();
-- DELETE FROM cart_items WHERE id = LAST_INSERT_ID();

