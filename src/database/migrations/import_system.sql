-- =====================================================
-- YMS/MES Import System - Database Schema
-- =====================================================

-- Table: inbound_receipts
-- Tracks truck arrivals from YMS imports
CREATE TABLE IF NOT EXISTS inbound_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  product_id uuid REFERENCES products(id),
  po_number text,
  
  -- Quantities
  loads int DEFAULT 1,
  location text CHECK (location IN ('dock', 'yard')) DEFAULT 'yard',
  
  -- YMS integration
  yms_reference text,        -- Trailer number, etc.
  checked_in_at timestamp,
  status text,
  
  -- Metadata
  imported_at timestamp DEFAULT now(),
  import_source text DEFAULT 'yms',
  created_at timestamp DEFAULT now(),
  
  -- Prevent duplicates
  UNIQUE(date, po_number)
);

-- Table: production_actuals
-- Tracks actual production from MES imports
CREATE TABLE IF NOT EXISTS production_actuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  product_id uuid REFERENCES products(id),
  
  -- Production quantities
  cases int NOT NULL,
  bottles int,
  shift text,
  
  -- Metadata
  imported_at timestamp DEFAULT now(),
  import_source text DEFAULT 'mes',
  created_at timestamp DEFAULT now(),
  
  -- Prevent duplicates (one entry per product per day per shift)
  UNIQUE(date, product_id, shift)
);

-- Table: inventory_snapshots (modified)
-- Add yard_loads and floor_pallets columns if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_snapshots' AND column_name = 'yard_loads'
  ) THEN
    ALTER TABLE inventory_snapshots ADD COLUMN yard_loads int DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_snapshots' AND column_name = 'floor_pallets'
  ) THEN
    ALTER TABLE inventory_snapshots ADD COLUMN floor_pallets int DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_snapshots' AND column_name = 'variance_pallets'
  ) THEN
    ALTER TABLE inventory_snapshots ADD COLUMN variance_pallets int DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_snapshots' AND column_name = 'notes'
  ) THEN
    ALTER TABLE inventory_snapshots ADD COLUMN notes text;
  END IF;
END $$;

-- Table: import_log
-- Audit trail for all imports
CREATE TABLE IF NOT EXISTS import_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL CHECK (import_type IN ('yms', 'mes')),
  file_name text,
  
  -- Results
  rows_total int,
  rows_imported int,
  rows_skipped int,
  rows_failed int,
  
  -- User tracking
  imported_by uuid REFERENCES auth.users(id),
  imported_at timestamp DEFAULT now(),
  
  -- Error details
  error_details jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbound_receipts_date ON inbound_receipts(date);
CREATE INDEX IF NOT EXISTS idx_inbound_receipts_product ON inbound_receipts(product_id);
CREATE INDEX IF NOT EXISTS idx_production_actuals_date ON production_actuals(date);
CREATE INDEX IF NOT EXISTS idx_production_actuals_product ON production_actuals(product_id);
CREATE INDEX IF NOT EXISTS idx_import_log_date ON import_log(imported_at);

-- Row Level Security (RLS) Policies
-- Note: Enable RLS when ready for multi-user

-- ALTER TABLE inbound_receipts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their org's receipts" ON inbound_receipts
--   FOR SELECT USING (auth.uid() IS NOT NULL);

-- ALTER TABLE production_actuals ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their org's production" ON production_actuals
--   FOR SELECT USING (auth.uid() IS NOT NULL);

-- ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their org's imports" ON import_log
--   FOR SELECT USING (auth.uid() IS NOT NULL);
