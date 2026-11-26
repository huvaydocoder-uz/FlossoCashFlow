-- =====================================================================
-- CashFlow — 5-bosqich: buyurtmalar
--   1) orders: mijoz, raqam (biznes ichida ketma-ket), manzil/lokatsiya, narx,
--      chegirma, sanalar, sotuvchi, qo'shimchalar, test mahsulotlar, holat
--   2) order_items: mahsulot qatorlari (rezka / quyma / mishalka, nomi, dona)
--   3) order_payments: bo'lib to'lovlar — naqd/karta, so'm/$; kurs muhrlanadi,
--      har to'lov kassaga kirim ("Buyurtma to'lovlari")
--   4) order_list view: sotuvchi boshqalar buyurtmasining pulini ko'rmaydi
-- Xato kodlari: FO001 to'lov qoldiqdan ko'p, FO002 sotuvchi jamoa a'zosi emas,
-- FO003 kurs real emas (5 000–50 000), FO004 narx/chegirma to'langandan kam,
-- FO005 to'lovi bor buyurtma valyutasi o'zgarmaydi, FO006 bekor qilingan buyurtmaga to'lov.
-- =====================================================================

begin;


-- 1. Turlar ---------------------------------------------------------------------

create type public.order_status as enum ('new', 'delivered', 'cancelled');
create type public.product_type as enum ('rezka', 'quyma', 'mishalka');

alter table public.businesses add column order_seq integer not null default 0;


-- 2. Buyurtmalar ----------------------------------------------------------------

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null default public.current_business_id()
                   references public.businesses (id) on delete cascade,
  number           integer not null,
  seller_id        uuid default auth.uid() references public.users (id) on delete set null,
  customer_name    text not null
                   check (customer_name = btrim(customer_name) and char_length(customer_name) between 1 and 100),
  phone            text check (phone is null or (char_length(phone) <= 20 and phone ~ '^[+0-9 ()-]*$')),
  address          text check (address is null or char_length(address) <= 300),
  location_url     text check (location_url is null or (char_length(location_url) <= 500 and location_url ~* '^https?://')),
  latitude         numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude        numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  agreed_price     numeric(18, 2) not null check (agreed_price >= 0),
  discount         numeric(18, 2) not null default 0 check (discount >= 0),
  currency         public.currency_code not null,
  order_date       date not null default current_date,
  delivery_date    date,
  status           public.order_status not null default 'new',
  free_delivery    boolean not null default false,
  installation     boolean not null default false,
  training         boolean not null default false,
  molds            boolean not null default false,
  penoplast_count  integer not null default 0 check (penoplast_count between 0 and 1000000),
  sand_kg          numeric(10, 2) not null default 0 check (sand_kg >= 0),
  chemicals_kg     numeric(10, 2) not null default 0 check (chemicals_kg >= 0),
  note             text check (note is null or char_length(note) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint orders_discount_le_price check (discount <= agreed_price),
  constraint orders_business_number_key unique (business_id, number)
);

create index orders_business_date_idx on public.orders (business_id, order_date desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  business_id   uuid not null default public.current_business_id()
                references public.businesses (id) on delete cascade,
  product_type  public.product_type not null,
  name          text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  quantity      integer not null check (quantity between 1 and 1000000),
  created_at    timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_payments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  business_id       uuid not null references public.businesses (id) on delete cascade,
  amount            numeric(18, 2) not null check (amount > 0),
  currency          public.currency_code not null,
  payment_method    public.payment_method not null,
  -- To'lov paytidagi kurs (1 $ = N so'm) — keyin kurs o'zgarsa ham hisob o'zgarmaydi.
  rate_uzs_per_usd  numeric(12, 2) not null check (rate_uzs_per_usd between 5000 and 50000),
  amount_usd        numeric(18, 2) not null,
  is_advance        boolean not null default false,
  paid_at           timestamptz not null default now(),
  received_by       uuid default auth.uid() references public.users (id) on delete set null,
  transaction_id    uuid references public.transactions (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index order_payments_order_idx on public.order_payments (order_id);


-- 3. Kassa: buyurtma to'lovi amallari --------------------------------------------

alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'debt_origin', 'debt_payment', 'order_payment'));

alter table public.transactions
  add column order_id uuid
    references public.orders (id) on delete cascade deferrable initially deferred;

create index transactions_order_idx on public.transactions (order_id) where order_id is not null;

-- Qo'lda yoziladigan amal buyurtmaga ham bog'lanmaydi (havolalarni faqat RPC yozadi).
drop policy transactions_owner_insert on public.transactions;
drop policy transactions_owner_update on public.transactions;
create policy transactions_owner_insert on public.transactions
  for insert to authenticated
  with check (
    public.is_business_owner(business_id)
    and user_id = (select auth.uid())
    and source = 'manual'
    and debt_id is null
    and order_id is null
  );
create policy transactions_owner_update on public.transactions
  for update to authenticated
  using (public.is_business_owner(business_id) and source = 'manual')
  with check (
    public.is_business_owner(business_id) and source = 'manual' and debt_id is null and order_id is null
  );


-- 4. Yordamchi funksiyalar ---------------------------------------------------------

-- Buyurtmani o'zgartirish huquqi: biznes egasi yoki buyurtma sotuvchisi.
create or replace function public.can_edit_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and o.business_id = public.current_business_id()
      and (public.is_business_owner(o.business_id) or o.seller_id = auth.uid())
  )
$$;

-- To'lov summasini buyurtma valyutasiga o'giradi (muhrlangan kurs bilan).
create or replace function public.to_order_currency(
  p_amount numeric,
  p_currency public.currency_code,
  p_order_currency public.currency_code,
  p_rate numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_currency = p_order_currency then p_amount
    when p_order_currency = 'USD' then p_amount / p_rate
    else p_amount * p_rate
  end
$$;


-- 5. Trigger'lar: raqam, sotuvchi, biznes ------------------------------------------

create or replace function public.prepare_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean;
  v_paid numeric;
begin
  if tg_op = 'INSERT' then
    v_is_owner := public.is_business_owner(new.business_id);
    update public.businesses
    set order_seq = order_seq + 1
    where id = new.business_id
    returning order_seq into new.number;
    -- Egasi sotuvchini tanlaydi (bo'sh bo'lsa — o'zi); sotuvchi doim o'zi yoziladi.
    if v_is_owner then
      new.seller_id := coalesce(new.seller_id, auth.uid());
    else
      new.seller_id := coalesce(auth.uid(), new.seller_id);
    end if;
  else
    v_is_owner := public.is_business_owner(old.business_id);
    new.id := old.id;
    new.created_at := old.created_at;
    new.number := old.number;
    new.business_id := old.business_id;
    if not v_is_owner then
      new.seller_id := old.seller_id;
    end if;

    -- To'lovlar bor bo'lsa: valyuta o'zgarmaydi, narx − chegirma to'langandan kam bo'lmaydi.
    select coalesce(round(sum(public.to_order_currency(amount, currency, old.currency, rate_uzs_per_usd)), 2), 0)
    into v_paid
    from public.order_payments where order_id = old.id;
    if v_paid > 0 and new.currency <> old.currency then
      raise exception 'order with payments cannot change currency' using errcode = 'FO005';
    end if;
    if new.agreed_price - new.discount < v_paid then
      raise exception 'price minus discount is below the paid total' using errcode = 'FO004';
    end if;
  end if;

  -- Sotuvchi faqat yangi buyurtmada yoki almashtirilganda tekshiriladi
  -- (jamoadan chiqqan sotuvchining eski buyurtmalari boshqarilaveradi).
  if (tg_op = 'INSERT' or new.seller_id is distinct from old.seller_id)
     and new.seller_id is not null and not exists (
    select 1 from public.business_members
    where business_id = new.business_id and user_id = new.seller_id and status = 'active'
  ) then
    raise exception 'seller is not an active team member' using errcode = 'FO002';
  end if;
  return new;
end;
$$;

create trigger orders_prepare
  before insert or update on public.orders
  for each row execute function public.prepare_order();

-- Mahsulot qatori doim o'z buyurtmasining biznesida.
create or replace function public.prepare_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.order_id := old.order_id;
  end if;
  select business_id into new.business_id from public.orders where id = new.order_id;
  return new;
end;
$$;

create trigger order_items_prepare
  before insert or update on public.order_items
  for each row execute function public.prepare_order_item();


-- 6. RLS --------------------------------------------------------------------------

alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.order_payments enable row level security;

-- Jadvalning o'zidan: egasi hammasini, sotuvchi faqat o'zinikini (pul bilan).
-- Umumiy ro'yxat (pulsiz) — order_list view orqali.
create policy orders_select on public.orders
  for select to authenticated
  using (
    public.is_business_owner(business_id)
    or (business_id = public.current_business_id() and seller_id = (select auth.uid()))
  );
create policy orders_insert on public.orders
  for insert to authenticated
  with check (business_id = public.current_business_id());
create policy orders_update on public.orders
  for update to authenticated
  using (
    public.is_business_owner(business_id)
    or (business_id = public.current_business_id() and seller_id = (select auth.uid()))
  )
  with check (business_id = public.current_business_id());
create policy orders_delete on public.orders
  for delete to authenticated
  using (public.is_business_owner(business_id));

create policy order_items_select on public.order_items
  for select to authenticated
  using (business_id = public.current_business_id());
create policy order_items_insert on public.order_items
  for insert to authenticated
  with check (public.can_edit_order(order_id));
create policy order_items_update on public.order_items
  for update to authenticated
  using (public.can_edit_order(order_id))
  with check (public.can_edit_order(order_id));
create policy order_items_delete on public.order_items
  for delete to authenticated
  using (public.can_edit_order(order_id));

create policy order_payments_select on public.order_payments
  for select to authenticated
  using (public.is_business_owner(business_id) or public.can_edit_order(order_id));

revoke all on public.orders, public.order_items, public.order_payments from anon, authenticated;
grant select, insert, update, delete on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select on public.order_payments to authenticated;


-- 7. Umumiy ro'yxat: pul maydonlari faqat egasiga yoki buyurtma sotuvchisiga ----

create view public.order_list as
select
  o.id,
  o.business_id,
  o.number,
  o.seller_id,
  u.full_name as seller_name,
  o.customer_name,
  o.phone,
  o.address,
  o.location_url,
  o.latitude,
  o.longitude,
  o.order_date,
  o.delivery_date,
  o.status,
  o.free_delivery,
  o.installation,
  o.training,
  o.molds,
  o.penoplast_count,
  o.sand_kg,
  o.chemicals_kg,
  o.note,
  o.created_at,
  o.updated_at,
  m.can_see_money,
  case when m.can_see_money then o.currency end as currency,
  case when m.can_see_money then o.agreed_price end as agreed_price,
  case when m.can_see_money then o.discount end as discount,
  case when m.can_see_money then p.paid end as paid,
  case when m.can_see_money then greatest(o.agreed_price - o.discount - p.paid, 0) end as remaining
from public.orders o
left join public.users u on u.id = o.seller_id
cross join lateral (
  select public.is_business_owner(o.business_id) or o.seller_id = auth.uid() as can_see_money
) m
cross join lateral (
  select coalesce(round(sum(public.to_order_currency(op.amount, op.currency, o.currency, op.rate_uzs_per_usd)), 2), 0) as paid
  from public.order_payments op
  where op.order_id = o.id
) p
where o.business_id = public.current_business_id();

revoke all on public.order_list from anon, authenticated;
grant select on public.order_list to authenticated;


-- 8. To'lov RPC'lari ----------------------------------------------------------

create or replace function public.add_order_payment(
  p_order_id uuid,
  p_amount numeric,
  p_currency public.currency_code,
  p_payment_method public.payment_method,
  p_rate numeric,
  p_is_advance boolean default false,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_amount numeric := round(p_amount, 2);
  v_rate numeric := round(p_rate, 2);
  v_paid numeric;
  v_payment_value numeric;
  v_transaction_id uuid;
  v_payment_id uuid;
begin
  -- Avval huquq: begona buyurtma qulflanmaydi va mavjudligi ham bilinmaydi.
  if not public.can_edit_order(p_order_id) then
    raise exception 'only the owner or the order seller can do this' using errcode = 'FB003';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.status = 'cancelled' then
    raise exception 'order is cancelled' using errcode = 'FO006';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '23514';
  end if;
  if v_rate is null or v_rate < 5000 or v_rate > 50000 then
    raise exception 'exchange rate is not realistic' using errcode = 'FO003';
  end if;

  select coalesce(sum(public.to_order_currency(amount, currency, v_order.currency, rate_uzs_per_usd)), 0)
  into v_paid
  from public.order_payments where order_id = p_order_id;

  v_payment_value := public.to_order_currency(v_amount, p_currency, v_order.currency, v_rate);
  if round(v_paid + v_payment_value, 2) > v_order.agreed_price - v_order.discount then
    raise exception 'payment exceeds the remaining amount' using errcode = 'FO001';
  end if;

  insert into public.transactions
    (user_id, business_id, category_id, type, amount, currency, payment_method, note, occurred_at, source, order_id)
  values
    (auth.uid(), v_order.business_id,
     public.debt_category_id(v_order.business_id, 'income', 'Buyurtma to''lovlari', auth.uid()),
     'income', v_amount, p_currency, p_payment_method,
     left('№' || lpad(v_order.number::text, 4, '0') || ' — ' || v_order.customer_name, 500),
     p_paid_at, 'order_payment', v_order.id)
  returning id into v_transaction_id;

  insert into public.order_payments
    (order_id, business_id, amount, currency, payment_method, rate_uzs_per_usd, amount_usd,
     is_advance, paid_at, received_by, transaction_id)
  values
    (v_order.id, v_order.business_id, v_amount, p_currency, p_payment_method, v_rate,
     round(public.to_order_currency(v_amount, p_currency, 'USD', v_rate), 2),
     coalesce(p_is_advance, false), p_paid_at, auth.uid(), v_transaction_id)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function public.delete_order_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.order_payments;
begin
  select * into v_payment from public.order_payments where id = p_payment_id;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  if not public.is_business_owner(v_payment.business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  delete from public.order_payments where id = p_payment_id;
  if v_payment.transaction_id is not null then
    delete from public.transactions where id = v_payment.transaction_id;
  end if;
end;
$$;

revoke all on function public.can_edit_order(uuid) from public, anon;
revoke all on function public.prepare_order() from public, anon, authenticated;
revoke all on function public.prepare_order_item() from public, anon, authenticated;
revoke all on function public.add_order_payment(uuid, numeric, public.currency_code, public.payment_method, numeric, boolean, timestamptz) from public, anon;
revoke all on function public.delete_order_payment(uuid) from public, anon;
grant execute on function public.can_edit_order(uuid) to authenticated;
grant execute on function public.to_order_currency(numeric, public.currency_code, public.currency_code, numeric) to authenticated;
grant execute on function public.add_order_payment(uuid, numeric, public.currency_code, public.payment_method, numeric, boolean, timestamptz) to authenticated;
grant execute on function public.delete_order_payment(uuid) to authenticated;

commit;
