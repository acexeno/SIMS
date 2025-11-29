-- Fix for duplicate builds issue
-- This migration adds a unique constraint to prevent duplicate builds

-- First, remove any existing duplicates (keep the most recent one)
DELETE ub1 FROM user_builds ub1
INNER JOIN user_builds ub2 
WHERE ub1.id < ub2.id 
  AND ub1.user_id = ub2.user_id 
  AND ub1.name = ub2.name 
  AND ub1.components = ub2.components;

-- Add a unique constraint to prevent future duplicates
-- This ensures no two builds can have the same user_id, name, and components
ALTER TABLE user_builds 
ADD CONSTRAINT unique_user_build_name_components 
UNIQUE (user_id, name, components);

-- Add an index for better performance on duplicate checks
CREATE INDEX idx_user_builds_duplicate_check 
ON user_builds (user_id, name, components);
