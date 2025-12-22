-- Migration: Add color_tag and pallets_per_truck to products table
-- Purpose: Remove hardcoded values for SKU colors and pallets-per-truck calculations
-- Safe to re-run: Uses "IF NOT EXISTS" pattern

-- 1. Add color_tag column (hex color for calendar/scheduler UI)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS color_tag TEXT DEFAULT '#3B82F6';

-- 2. Add pallets_per_truck column (pallets per full truck load)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS pallets_per_truck INTEGER DEFAULT 22;

-- Add documentation
COMMENT ON COLUMN products.color_tag IS 'Hex color code for UI display (e.g., #3B82F6 for blue)';
COMMENT ON COLUMN products.pallets_per_truck IS 'Number of pallets per full truck load';

-- Backfill existing products with sensible defaults based on name patterns (optional)
-- Uncomment if you want to auto-assign colors to existing products
/*
UPDATE products SET color_tag = '#3B82F6' WHERE name ILIKE '%20oz%' AND color_tag IS NULL;
UPDATE products SET color_tag = '#6366F1' WHERE name ILIKE '%2L%' AND color_tag IS NULL;
UPDATE products SET color_tag = '#8B5CF6' WHERE name ILIKE '%1L%' AND color_tag IS NULL;
UPDATE products SET color_tag = '#10B981' WHERE name ILIKE '%12pk%' AND color_tag IS NULL;
*/
