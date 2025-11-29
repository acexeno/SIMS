-- Inventory Performance Indexes
-- Purpose: Optimize queries for dropdown filtering, sorting, and search operations
-- 
-- Based on the Inventory UI dropdowns:
-- 1. "All Components" dropdown - filters by category_id
-- 2. "All Brands" dropdown - filters by brand
-- 3. "Sort by Name" dropdown - sorts by name
-- 4. Search functionality - searches by name and brand

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ============================================
-- INDEXES FOR COMPONENTS TABLE
-- ============================================

-- Index for category filtering (All Components dropdown)
-- This speeds up queries like: SELECT * FROM components WHERE category_id = ?
CREATE INDEX IF NOT EXISTS idx_components_category_id 
ON components (category_id);

-- Index for brand filtering (All Brands dropdown)
-- This speeds up queries like: SELECT * FROM components WHERE brand = ?
CREATE INDEX IF NOT EXISTS idx_components_brand 
ON components (brand);

-- Index for name-based sorting (Sort by Name dropdown)
-- This speeds up queries like: SELECT * FROM components ORDER BY name
CREATE INDEX IF NOT EXISTS idx_components_name 
ON components (name);

-- Composite index for combined filtering and sorting
-- This speeds up queries like: SELECT * FROM components WHERE category_id = ? ORDER BY name
CREATE INDEX IF NOT EXISTS idx_components_category_name 
ON components (category_id, name);

-- Composite index for brand + name sorting
-- This speeds up queries like: SELECT * FROM components WHERE brand = ? ORDER BY name
CREATE INDEX IF NOT EXISTS idx_components_brand_name 
ON components (brand, name);

-- Index for active/inactive filtering
-- This speeds up queries filtering by is_active status
CREATE INDEX IF NOT EXISTS idx_components_is_active 
ON components (is_active);

-- Full-text index for search functionality (searching by name and brand)
-- Note: Full-text indexes require MyISAM or InnoDB with innodb_ft_min_token_size setting
-- This speeds up searches like: SELECT * FROM components WHERE MATCH(name, brand) AGAINST ('search term')
-- Note: ALTER TABLE doesn't support IF NOT EXISTS, so run this separately if you get an error
-- To check if fulltext index exists: SHOW INDEX FROM components WHERE Key_name = 'idx_components_search';
ALTER TABLE components ADD FULLTEXT INDEX idx_components_search (name, brand);

-- ============================================
-- INDEXES FOR COMPONENT_CATEGORIES TABLE
-- ============================================

-- Index for category name lookup (for joins and filtering)
CREATE INDEX IF NOT EXISTS idx_categories_name 
ON component_categories (name);

-- ============================================
-- INDEXES FOR ORDER-RELATED QUERIES
-- ============================================

-- Index for filtering components by stock status
-- This helps identify low stock items quickly
CREATE INDEX IF NOT EXISTS idx_components_stock 
ON components (stock_quantity);

-- Index for price sorting
CREATE INDEX IF NOT EXISTS idx_components_price 
ON components (price);

-- ============================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================

-- Composite index for active items with stock filtering
CREATE INDEX IF NOT EXISTS idx_components_active_stock 
ON components (is_active, stock_quantity);

-- Composite index for category + active + stock
CREATE INDEX IF NOT EXISTS idx_components_category_active_stock 
ON components (category_id, is_active, stock_quantity);

SET FOREIGN_KEY_CHECKS=1;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify indexes were created successfully:
-- 
-- SHOW INDEX FROM components;
-- SHOW INDEX FROM component_categories;
--
-- EXPLAIN SELECT * FROM components WHERE category_id = 1 ORDER BY name;
-- EXPLAIN SELECT * FROM components WHERE brand = 'AMD' ORDER BY name;
-- EXPLAIN SELECT * FROM components WHERE name LIKE '%ryzen%' OR brand LIKE '%amd%';
-- 
-- ============================================
-- WHAT EACH INDEX DOES:
-- ============================================
-- 1. idx_components_category_id: Fast filtering by component category
-- 2. idx_components_brand: Fast filtering by brand name
-- 3. idx_components_name: Fast sorting by product name
-- 4. idx_components_category_name: Fast filtering + sorting combination
-- 5. idx_components_brand_name: Fast brand filtering + sorting
-- 6. idx_components_is_active: Fast active/inactive filtering
-- 7. idx_components_search (FULLTEXT): Fast text search across name and brand
-- 8. idx_categories_name: Fast category name lookups
-- 9. idx_components_stock: Fast stock quantity filtering/sorting
-- 10. idx_components_price: Fast price-based sorting
-- 11. idx_components_active_stock: Fast active + stock filtering
-- 12. idx_components_category_active_stock: Complex multi-column filtering

