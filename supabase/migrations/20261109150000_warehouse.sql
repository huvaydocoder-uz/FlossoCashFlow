-- =====================================================================
-- CashFlow — ombor va sotuv hisoboti
--   1) stock_items: mahsulotlar (rezka/quyma/mishalka) va materiallar katalogi;
--      doimiy materiallar — penoplast (dona), qum (kg), ximikat (kg)
--   2) stock_movements: kirim/chiqim; buyurtma "Yetkazildi" bo'lganda mahsulot va
--      test materiallari avtomatik chiqim, qayta ochilsa/bekor qilinsa — qaytariladi
--   3) stock_balances: qoldiq (faqat egasiga)
--   4) sales_report / top_products: oylar va sotuvchilar kesimida (faqat egasiga)
-- Xato kodlari: FW001 harakati bor ombor pozitsiyasi o'chmaydi.
-- =====================================================================

begin;


-- 1. Katalog va harakatlar -------------------------------------------------------

create type public.stock_kind as enum ('product', 'material');
create type public.stock_unit as enum ('dona', 'kg');
create type public.stock_direction as enum ('in', 'out');
create type public.stock_reason as enum ('production', 'purchase', 'writeoff', 'adjustment', 'order');

create table public.stock_items (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null default public.current_business_id()
                references public.businesses (id) on delete cascade,
  kind          public.stock_kind not null,
  product_type  public.product_type,
  name          text not null check (name = btrim(name) and char_length(name) between 1 and 100),
  unit          public.stock_unit not null default 'dona',
  min_qty       numeric(14, 2) not null default 0 check (min_qty >= 0),
  -- Doimiy materiallar (test mahsulotlar shularga yoziladi): penoplast, sand, chemicals.
  system_key    text check (system_key is null or system_key in ('penoplast', 'sand', 'chemicals')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint stock_items_business_system_key unique (business_id, system_key)
);

create unique index stock_items_business_name_key on public.stock_items (business_id, kind, lower(name));

create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  stock_item_id  uuid not null references public.stock_items (id) on delete cascade,
  direction      public.stock_direction not null,
  quantity       numeric(14, 2) not null check (quantity > 0),
  reason         public.stock_reason not null,
  order_id       uuid references public.orders (id) on delete cascade,
  note           text check (note is null or char_length(note) <= 300),
  moved_at       timestamptz not null default now(),
  user_id        uuid default auth.uid() references public.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint stock_movements_order_reason check ((reason = 'order') = (order_id is not null))
);

create index stock_movements_item_idx on public.stock_movements (stock_item_id, moved_at desc);
create index stock_movements_order_idx on public.stock_movements (order_id) where order_id is not null;

alter table public.order_items
  add column stock_item_id uuid references public.stock_items (id) on delete set null;


-- 2. Trigger'lar: biznes va havolalar mijozga ishonilmaydi ------------------------

-- security invoker: mijoz so'rovida current_user = 'authenticated' (system_key ni o'zgartira
-- olmaydi); material_item_id (definer) ichidan esa — funksiya egasi (doimiy materiallarni boshqaradi).
create or replace function public.prepare_stock_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client boolean := current_user = 'authenticated';
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.stock_movements where stock_item_id = old.id) then
      raise exception 'stock item has movements' using errcode = 'FW001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.business_id := old.business_id;
    new.created_at := old.created_at;
    if v_client then
      new.system_key := old.system_key;
      new.kind := old.kind;
      -- Doimiy material nomi va o'lchovi o'zgarmaydi (test mahsulotlar shularga yoziladi).
      if old.system_key is not null then
        new.name := old.name;
        new.unit := old.unit;
      end if;
    end if;
  elsif v_client then
    -- Doimiy materiallarni faqat ensure_stock_defaults / material_item_id yaratadi.
    new.system_key := null;
  end if;
  if new.kind = 'material' then
    new.product_type := null;
  end if;
  return new;
end;
$$;

create trigger stock_items_prepare
  before insert or update or delete on public.stock_items
  for each row execute function public.prepare_stock_item();

create or replace function public.prepare_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select business_id into new.business_id from public.stock_items where id = new.stock_item_id;
  return new;
end;
$$;

create trigger stock_movements_prepare
  before insert on public.stock_movements
  for each row execute function public.prepare_stock_movement();

-- Buyurtma qatori faqat o'z biznesidagi katalogga bog'lanadi.
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
  if new.stock_item_id is not null and not exists (
    select 1 from public.stock_items
    where id = new.stock_item_id and business_id = new.business_id and kind = 'product'
  ) then
    new.stock_item_id := null;
  end if;
  return new;
end;
$$;


-- 3. Buyurtma ↔ ombor --------------------------------------------------------------

-- Doimiy material (bo'lmasa yaratiladi).
create or replace function public.material_item_id(p_business_id uuid, p_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := case p_key when 'penoplast' then 'Penoplast' when 'sand' then 'Qum' else 'Ximikat' end;
begin
  select id into v_id from public.stock_items where business_id = p_business_id and system_key = p_key;
  if v_id is null then
    -- Shu nomli material allaqachon bo'lsa — o'shani doimiy material qilamiz.
    update public.stock_items
    set system_key = p_key
    where business_id = p_business_id and kind = 'material' and system_key is null and lower(name) = lower(v_name)
    returning id into v_id;
  end if;
  if v_id is null then
    insert into public.stock_items (business_id, kind, name, unit, system_key)
    values (
      p_business_id, 'material', v_name,
      case p_key when 'penoplast' then 'dona'::public.stock_unit else 'kg'::public.stock_unit end,
      p_key
    )
    on conflict do nothing;
    select id into v_id from public.stock_items where business_id = p_business_id and system_key = p_key;
  end if;
  return v_id;
end;
$$;

-- Buyurtmaning ombor harakatlarini qayta yozadi: yetkazilgan bo'lsa — chiqim, aks holda — yo'q.
create or replace function public.sync_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  -- Bir buyurtmani bir vaqtda ikki so'rov sinxronlamasin (ikki marta ayirish yoki eskirgan holat).
  perform 1 from public.orders where id = p_order_id for update;
  delete from public.stock_movements where order_id = p_order_id and reason = 'order';
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.status <> 'delivered' then
    return;
  end if;

  insert into public.stock_movements (business_id, stock_item_id, direction, quantity, reason, order_id, user_id)
  select v_order.business_id, oi.stock_item_id, 'out', sum(oi.quantity), 'order', v_order.id, auth.uid()
  from public.order_items oi
  where oi.order_id = v_order.id and oi.stock_item_id is not null
  group by oi.stock_item_id;

  insert into public.stock_movements (business_id, stock_item_id, direction, quantity, reason, order_id, user_id)
  select v_order.business_id, public.material_item_id(v_order.business_id, m.key), 'out', m.amount, 'order', v_order.id, auth.uid()
  from (values
    ('penoplast', v_order.penoplast_count::numeric),
    ('sand', v_order.sand_kg),
    ('chemicals', v_order.chemicals_kg)
  ) as m (key, amount)
  where m.amount > 0;
end;
$$;

create or replace function public.orders_stock_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.penoplast_count is distinct from old.penoplast_count
     or new.sand_kg is distinct from old.sand_kg
     or new.chemicals_kg is distinct from old.chemicals_kg then
    perform public.sync_order_stock(new.id);
  end if;
  return null;
end;
$$;

create trigger orders_stock
  after insert or update on public.orders
  for each row execute function public.orders_stock_trigger();

create or replace function public.order_items_stock_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_order_stock(coalesce(new.order_id, old.order_id));
  return null;
end;
$$;

create trigger order_items_stock
  after insert or update or delete on public.order_items
  for each row execute function public.order_items_stock_trigger();


-- 4. Qoldiq (faqat egasiga) -----------------------------------------------------------

create view public.stock_balances
with (security_invoker = on) as
select
  i.id as stock_item_id,
  i.business_id,
  coalesce(sum(case when m.direction = 'in' then m.quantity else -m.quantity end), 0) as quantity
from public.stock_items i
left join public.stock_movements m on m.stock_item_id = i.id
where public.is_business_owner(i.business_id)
group by i.id, i.business_id;


-- 5. RLS -----------------------------------------------------------------------------

alter table public.stock_items     enable row level security;
alter table public.stock_movements enable row level security;

-- Katalog nomlari jamoaga (sotuvchi buyurtmada tanlaydi); o'zgartirish — egasi.
create policy stock_items_select on public.stock_items
  for select to authenticated using (business_id = public.current_business_id());
create policy stock_items_insert on public.stock_items
  for insert to authenticated
  with check (business_id = public.current_business_id() and public.is_business_owner(business_id));
create policy stock_items_update on public.stock_items
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
create policy stock_items_delete on public.stock_items
  for delete to authenticated using (public.is_business_owner(business_id));

-- Harakatlar — faqat egasi; buyurtma harakatlarini faqat trigger yozadi.
create policy stock_movements_select on public.stock_movements
  for select to authenticated using (public.is_business_owner(business_id));
create policy stock_movements_insert on public.stock_movements
  for insert to authenticated
  with check (
    public.is_business_owner(business_id)
    and reason <> 'order'
    and order_id is null
    and user_id = (select auth.uid())
  );
create policy stock_movements_delete on public.stock_movements
  for delete to authenticated
  using (public.is_business_owner(business_id) and reason <> 'order');

revoke all on public.stock_items, public.stock_movements, public.stock_balances from anon, authenticated;
grant select, insert, update, delete on public.stock_items to authenticated;
grant select, insert, delete on public.stock_movements to authenticated;
grant select on public.stock_balances to authenticated;


-- 6. Doimiy materiallar ---------------------------------------------------------------

create or replace function public.ensure_stock_defaults()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := public.current_business_id();
begin
  if v_business_id is null or not public.is_business_owner(v_business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  perform public.material_item_id(v_business_id, k) from unnest(array['penoplast', 'sand', 'chemicals']) as k;
end;
$$;

-- Mavjud bizneslar uchun darhol.
select public.material_item_id(b.id, k)
from public.businesses b
cross join unnest(array['penoplast', 'sand', 'chemicals']) as k;


-- 7. Sotuv hisoboti (faqat egasiga) ----------------------------------------------------

create or replace function public.sales_report(p_from date, p_to date)
returns table (
  month            date,
  seller_id        uuid,
  seller_name      text,
  orders_count     integer,
  delivered_count  integer,
  cancelled_count  integer,
  agreed_uzs       numeric,
  agreed_usd       numeric,
  paid_usd         numeric,
  remaining_uzs    numeric,
  remaining_usd    numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := public.current_business_id();
begin
  if v_business_id is null or not public.is_business_owner(v_business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  return query
  with o as (
    select
      ord.*,
      coalesce((
        select sum(public.to_order_currency(op.amount, op.currency, ord.currency, op.rate_uzs_per_usd))
        from public.order_payments op where op.order_id = ord.id
      ), 0) as paid_in_currency,
      coalesce((select sum(op.amount_usd) from public.order_payments op where op.order_id = ord.id), 0) as paid_usd
    from public.orders ord
    where ord.business_id = v_business_id and ord.order_date between p_from and p_to
  )
  select
    date_trunc('month', o.order_date)::date,
    o.seller_id,
    u.full_name,
    count(*)::integer,
    count(*) filter (where o.status = 'delivered')::integer,
    count(*) filter (where o.status = 'cancelled')::integer,
    coalesce(sum(o.agreed_price - o.discount) filter (where o.status <> 'cancelled' and o.currency = 'UZS'), 0),
    coalesce(sum(o.agreed_price - o.discount) filter (where o.status <> 'cancelled' and o.currency = 'USD'), 0),
    coalesce(round(sum(o.paid_usd) filter (where o.status <> 'cancelled'), 2), 0),
    coalesce(round(sum(greatest(o.agreed_price - o.discount - o.paid_in_currency, 0))
      filter (where o.status <> 'cancelled' and o.currency = 'UZS'), 2), 0),
    coalesce(round(sum(greatest(o.agreed_price - o.discount - o.paid_in_currency, 0))
      filter (where o.status <> 'cancelled' and o.currency = 'USD'), 2), 0)
  from o
  left join public.users u on u.id = o.seller_id
  group by 1, o.seller_id, u.full_name
  order by 1 desc, 3;
end;
$$;

create or replace function public.top_products(p_from date, p_to date)
returns table (
  product_type   public.product_type,
  name           text,
  stock_item_id  uuid,
  quantity       numeric,
  orders_count   integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := public.current_business_id();
begin
  if v_business_id is null or not public.is_business_owner(v_business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  return query
  select oi.product_type, coalesce(si.name, oi.name), oi.stock_item_id,
         sum(oi.quantity)::numeric, count(distinct oi.order_id)::integer
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.stock_items si on si.id = oi.stock_item_id
  where o.business_id = v_business_id
    and o.status <> 'cancelled'
    and o.order_date between p_from and p_to
  group by oi.product_type, coalesce(si.name, oi.name), oi.stock_item_id
  order by 4 desc
  limit 20;
end;
$$;

revoke all on function public.prepare_stock_movement() from public, anon, authenticated;
revoke all on function public.material_item_id(uuid, text) from public, anon, authenticated;
revoke all on function public.sync_order_stock(uuid) from public, anon, authenticated;
revoke all on function public.orders_stock_trigger() from public, anon, authenticated;
revoke all on function public.order_items_stock_trigger() from public, anon, authenticated;
revoke all on function public.ensure_stock_defaults() from public, anon;
revoke all on function public.sales_report(date, date) from public, anon;
revoke all on function public.top_products(date, date) from public, anon;
grant execute on function public.ensure_stock_defaults() to authenticated;
grant execute on function public.sales_report(date, date) to authenticated;
grant execute on function public.top_products(date, date) to authenticated;

commit;
