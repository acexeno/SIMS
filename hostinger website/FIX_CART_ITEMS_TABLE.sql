-- ============================================
-- FIX CART_ITEMS TABLE - AUTO_INCREMENT ISSUE
-- ============================================
-- Run these SQL commands in your database (phpMyAdmin or MySQL client)
-- This will fix the cart_items table so items can be added to cart

-- Step 1: Check current state of cart_items table
SELECT * FROM cart_items ORDER BY id DESC LIMIT 10;
SELECT MAX(id) as max_id FROM cart_items;
SHOW CREATE TABLE cart_items;

-- Step 2: Delete any invalid records with id = 0 (if any exist)
DELETE FROM cart_items WHERE id = 0;

-- Step 3: Get the maximum ID and set AUTO_INCREMENT properly
-- First, find the max ID
SELECT MAX(id) as max_id FROM cart_items;

-- Step 4: Set AUTO_INCREMENT to max_id + 1 (or 1 if table is empty)
-- Replace 'X' with the actual max_id from Step 3, or use 1 if table is empty
-- Example: If max_id is 5, set AUTO_INCREMENT to 6
ALTER TABLE cart_items AUTO_INCREMENT = 1;

-- If you have existing records, use this instead (replace X with max_id + 1):
-- ALTER TABLE cart_items AUTO_INCREMENT = X;

-- Step 5: Verify the fix
SHOW CREATE TABLE cart_items;
-- Look for: AUTO_INCREMENT=X in the output

-- Step 6: Test insert (optional - you can delete this test record after)
-- INSERT INTO cart_items (user_id, component_id, quantity) VALUES (1, 1, 1);
-- SELECT LAST_INSERT_ID();
-- DELETE FROM cart_items WHERE id = LAST_INSERT_ID();

-- ============================================
-- ALTERNATIVE: If AUTO_INCREMENT is completely broken
-- ============================================
-- If the above doesn't work, you may need to recreate the table
-- WARNING: This will DELETE ALL CART ITEMS! Only use if absolutely necessary.

-- Step A: Backup existing cart data (optional)
-- CREATE TABLE cart_items_backup AS SELECT * FROM cart_items;

-- Step B: Drop and recreate the table
-- DROP TABLE IF EXISTS cart_items;

-- CREATE TABLE cart_items (
--     id INT AUTO_INCREMENT PRIMARY KEY,
--     user_id INT NOT NULL,
--     component_id INT NULL,
--     prebuilt_id INT NULL,
--     quantity INT NOT NULL DEFAULT 1,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
--     FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
--     FOREIGN KEY (prebuilt_id) REFERENCES prebuilts(id) ON DELETE CASCADE,
--     UNIQUE KEY unique_user_component (user_id, component_id),
--     UNIQUE KEY unique_user_prebuilt (user_id, prebuilt_id),
--     INDEX idx_user_id (user_id),
--     INDEX idx_component_id (component_id),
--     INDEX idx_prebuilt_id (prebuilt_id),
--     CHECK ((component_id IS NOT NULL AND prebuilt_id IS NULL) OR (component_id IS NULL AND prebuilt_id IS NOT NULL))
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;

-- Step C: Restore data from backup (if you created one)
-- INSERT INTO cart_items SELECT * FROM cart_items_backup;
-- DROP TABLE cart_items_backup;

