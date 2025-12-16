-- Secure RLS Update for Procurement Orders
-- Author: Refactor Agent
-- Date: 2025-12-16

-- 1. Drop existing loose policies
drop policy if exists "Enable read access for all users" on procurement_orders;
drop policy if exists "Enable insert for authenticated users" on procurement_orders;
drop policy if exists "Enable update for authenticated users" on procurement_orders;
drop policy if exists "Enable delete for authenticated users" on procurement_orders;

-- 2. Create stricter policies (User Isolation)
-- Assuming 'user_id' column is populated correctly. 

-- READ: Users can only see their own orders OR all orders if they are admin/planner (optional, implemented as loose for now just in case of shared team)
-- If strictly private:
-- create policy "enable_read_own" on procurement_orders for select using (auth.uid() = user_id);

-- CURRENT APP LOGIC seems to assume shared visibility or doesn't filter by user_id in `fetchProcurementOrders`.
-- If we want to change this, we must update `fetchProcurementOrders` to filter or trust RLS.
-- Safest improvement without breaking "Shared Schedule" feature:
create policy "Allow authenticated read" on procurement_orders for select to authenticated using (true);

-- WRITE: Only allow users to modify their own records, or records they created
create policy "Allow insert with own user_id" on procurement_orders for insert with check (auth.uid() = user_id);

create policy "Allow update own records" on procurement_orders for update using (auth.uid() = user_id);

create policy "Allow delete own records" on procurement_orders for delete using (auth.uid() = user_id);
