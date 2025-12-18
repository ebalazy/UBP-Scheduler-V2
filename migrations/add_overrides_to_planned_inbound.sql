-- Add appointment_time and status to planned_inbound for manual overrides
ALTER TABLE planned_inbound ADD COLUMN IF NOT EXISTS appointment_time TIME;
ALTER TABLE planned_inbound ADD COLUMN IF NOT EXISTS status TEXT;

-- Index for appointment_time
CREATE INDEX IF NOT EXISTS idx_planned_inbound_appt_time ON planned_inbound(appointment_time) WHERE appointment_time IS NOT NULL;
