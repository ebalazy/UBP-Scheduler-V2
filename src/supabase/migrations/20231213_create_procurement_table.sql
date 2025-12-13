-- Create a table for Purchase Orders (Procurement)
create table if not exists procurement_orders (
  id uuid default uuid_generate_v4() primary key,
  date date not null,
  po_number text not null,
  supplier text,
  quantity numeric,
  status text default 'planned',
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add uniqueness constraint to prevent duplicates if needed
-- alter table procurement_orders add constraint unique_po unique (po_number);

-- Enable RLS
alter table procurement_orders enable row level security;

-- Policies (Adjust based on your team's security model)
-- Allow authenticated users to view all orders (Shared View)
create policy "Enable read access for all users" on procurement_orders for select using (auth.role() = 'authenticated');

-- Allow users to insert/update
create policy "Enable insert for authenticated users" on procurement_orders for insert with check (auth.role() = 'authenticated');
create policy "Enable update for authenticated users" on procurement_orders for update using (auth.role() = 'authenticated');
create policy "Enable delete for authenticated users" on procurement_orders for delete using (auth.role() = 'authenticated');
