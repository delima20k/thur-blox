create table if not exists store_products (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  seed_slug text not null,
  name text not null,
  image_url text,
  price_in_cents integer,
  currency text not null default 'BRL',
  sale_enabled boolean not null default false,
  available_stock integer not null default 0,
  reserved_stock integer not null default 0,
  max_per_order integer,
  delivery_type text not null default 'manual_in_game',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game, seed_slug),
  check (price_in_cents is null or price_in_cents >= 0),
  check (available_stock >= 0),
  check (reserved_stock >= 0),
  check (max_per_order is null or max_per_order > 0)
);

create table if not exists store_orders (
  id uuid primary key default gen_random_uuid(),
  public_order_code text not null unique,
  customer_name text not null,
  roblox_username text not null,
  roblox_display_name text,
  customer_email text,
  customer_phone text,
  subtotal_in_cents integer not null,
  discount_in_cents integer not null default 0,
  total_in_cents integer not null,
  currency text not null default 'BRL',
  coupon_code text,
  order_status text not null default 'awaiting_payment',
  payment_status text not null default 'pending',
  delivery_status text not null default 'pending',
  payment_provider text,
  payment_id text,
  pix_copy_paste text,
  pix_qr_code text,
  pix_expires_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  delivery_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subtotal_in_cents >= 0),
  check (discount_in_cents >= 0),
  check (total_in_cents >= 0),
  check (order_status in ('draft','awaiting_payment','paid','preparing_delivery','ready_for_delivery','delivered','cancelled','refunded','disputed')),
  check (payment_status in ('pending','confirmed','expired','cancelled','refunded','failed','disputed')),
  check (delivery_status in ('pending','contacting_customer','scheduled','delivering','delivered','failed','cancelled'))
);

create table if not exists store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store_orders(id) on delete cascade,
  product_id uuid not null references store_products(id),
  seed_slug text not null,
  product_name_snapshot text not null,
  image_url_snapshot text,
  unit_price_in_cents integer not null,
  quantity integer not null,
  subtotal_in_cents integer not null,
  created_at timestamptz not null default now(),
  check (unit_price_in_cents >= 0),
  check (quantity > 0),
  check (subtotal_in_cents >= 0)
);

create table if not exists store_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null,
  discount_value integer not null,
  minimum_order_in_cents integer not null default 0,
  maximum_discount_in_cents integer,
  total_usage_limit integer,
  usage_limit_per_customer integer,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default false,
  applicable_product_slugs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type in ('percentage','fixed')),
  check (discount_value > 0),
  check (discount_type <> 'percentage' or discount_value <= 100),
  check (minimum_order_in_cents >= 0),
  check (maximum_discount_in_cents is null or maximum_discount_in_cents >= 0),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists store_coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references store_coupons(id),
  order_id uuid not null references store_orders(id),
  customer_identifier_hash text not null,
  used_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create table if not exists store_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payment_id text,
  order_id uuid references store_orders(id),
  payload_hash text not null,
  processed boolean not null default false,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists store_order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store_orders(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by text not null,
  reason text,
  created_at timestamptz not null default now()
);
