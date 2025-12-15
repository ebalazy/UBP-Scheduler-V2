-- Migration to enhance products table with detailed logistics and identification data

alter table products 
add column if not exists ti integer default 0,
add column if not exists hi integer default 0,
add column if not exists case_weight numeric default 0,
add column if not exists pallet_type text,
add column if not exists color_tag text default '#3B82F6', -- Default Blue
add column if not exists internal_sku text,
add column if not exists customer_sku text;

comment on column products.ti is 'Cases per Tier';
comment on column products.hi is 'Tiers High';
comment on column products.case_weight is 'Weight per case in lbs';
