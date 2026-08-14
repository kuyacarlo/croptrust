-- Reviews table for buyer feedback on completed orders
-- Mirrors the Prisma model in backend/prisma/schema.prisma

create table if not exists public.reviews (
  id         text        primary key default gen_random_uuid()::text,
  order_id   text        not null references public.orders(id) on delete cascade,
  reviewer   text        not null,
  farmer_id  text        not null,
  rating     integer     not null check (rating >= 1 and rating <= 5),
  comment    text,
  created_at timestamptz not null default now(),
  unique (order_id, reviewer)
);

create index if not exists reviews_farmer_id_idx on public.reviews(farmer_id);
create index if not exists reviews_order_id_idx on public.reviews(order_id);

alter table public.reviews enable row level security;

-- Allow anyone to read reviews (public data)
drop policy if exists "reviews_select" on public.reviews;
create policy "reviews_select"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- Allow authenticated users to insert reviews
drop policy if exists "reviews_insert" on public.reviews;
create policy "reviews_insert"
  on public.reviews for insert
  to authenticated
  with check (reviewer = current_user);
