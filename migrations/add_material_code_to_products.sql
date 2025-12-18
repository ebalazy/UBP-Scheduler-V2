-- Add material_code column to products table
-- This allows direct mapping from SAP material codes to products

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS material_code TEXT;

-- Create index for faster SAP import lookups
CREATE INDEX IF NOT EXISTS idx_products_material_code 
ON products(material_code) 
WHERE material_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN products.material_code IS 'SAP material code (e.g., 1855526 for 20oz bottles)';
