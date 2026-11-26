-- =====================================================================
-- CashFlow — 3-bosqich: biznes va jamoa
--   1) businesses (biznes) va business_members (a'zolar: egasi / sotuvchi)
--   2) Mavjud har bir foydalanuvchi — o'z biznesining egasi
--   3) categories, transactions, debts — endi biznesga tegishli (business_id)
--   4) RLS: moliya faqat biznesning faol egasiga; sotuvchiga ko'rinmaydi
--   5) RPC: create_business, join_business, approve_member, remove_member, leave_business
--
-- Eski ilova ham ishlashda davom etadi: business_id standart qiymati —
-- joriy foydalanuvchining biznesi (current_business_id()).
-- Xato kodlari: FB001 allaqachon biznesi bor, FB002 kod topilmadi,
-- FB003 faqat egasi, FB004 egani chiqarib bo'lmaydi, FB005 a'zo topilmadi.
-- =====================================================================

begin;


-- 1. Turlar va jadvallar ----------------------------------------------------

create type public.member_role   as enum ('owner', 'seller');
create type public.member_status as enum ('pending', 'active');

create table public.businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null
              check (name = btrim(name) and char_length(name) between 1 and 100),
  owner_id    uuid not null references public.users (id) on delete cascade,
  -- 6 ta belgi; chalkash I, O, 0, 1 ishlatilmaydi.
  join_code   text not null unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- Bir foydalanuvchi — bitta biznes (user_id unique).
create table public.business_members (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null unique references public.users (id) on delete cascade,
  role         public.member_role not null,
  status       public.member_status not null default 'pending',
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);


-- 2. Yordamchi funksiyalar --------------------------------------------------
-- security definer: RLS ichida business_members'ni rekursiyasiz o'qish uchun.

create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select business_id
  from public.business_members
  where user_id = auth.uid() and status = 'active'
$$;

create or replace function public.is_business_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  )
$$;

create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.businesses where join_code = v_code);
  end loop;
  return v_code;
end;
$$;


-- 3. Mavjud foydalanuvchilar — o'z biznesining egasi ------------------------

do $$
declare
  r record;
  v_business_id uuid;
begin
  for r in select id from public.users loop
    insert into public.businesses (name, owner_id, join_code)
    values ('Flosso', r.id, public.generate_join_code())
    returning id into v_business_id;

    insert into public.business_members (business_id, user_id, role, status)
    values (v_business_id, r.id, 'owner', 'active');
  end loop;
end;
$$;


-- 4. Moliya jadvallari biznesga --------------------------------------------

alter table public.categories   add column business_id uuid references public.businesses (id) on delete cascade;
alter table public.transactions add column business_id uuid references public.businesses (id) on delete cascade;
alter table public.debts        add column business_id uuid references public.businesses (id) on delete cascade;

update public.categories c   set business_id = m.business_id from public.business_members m where m.user_id = c.user_id;
update public.transactions t set business_id = m.business_id from public.business_members m where m.user_id = t.user_id;
update public.debts d        set business_id = m.business_id from public.business_members m where m.user_id = d.user_id;

alter table public.categories
  alter column business_id set not null,
  alter column business_id set default public.current_business_id();
alter table public.transactions
  alter column business_id set not null,
  alter column business_id set default public.current_business_id();
alter table public.debts
  alter column business_id set not null,
  alter column business_id set default public.current_business_id();

-- Kategoriya noyobligi va amal → kategoriya bog'lanishi endi biznes bo'yicha.
alter table public.transactions drop constraint transactions_category_fkey;
alter table public.categories   drop constraint categories_id_user_type_key;
drop index public.categories_user_type_name_key;

alter table public.categories
  add constraint categories_id_business_type_key unique (id, business_id, type);

create unique index categories_business_type_name_key
  on public.categories (business_id, type, lower(name));

alter table public.transactions
  add constraint transactions_category_fkey
  foreign key (category_id, business_id, type)
  references public.categories (id, business_id, type)
  on delete set null (category_id);

create index transactions_business_occurred_idx on public.transactions (business_id, occurred_at desc);
create index debts_business_due_idx on public.debts (business_id, due_date);


-- 5. balances — biznes bo'yicha --------------------------------------------

drop view public.balances;

create view public.balances
with (security_invoker = on) as
select
  business_id,
  currency,
  coalesce(sum(amount) filter (where type = 'income'), 0)  as total_income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
  sum(case when type = 'income' then amount else -amount end) as balance,
  payment_method
from public.transactions
group by business_id, currency, payment_method;


-- 6. RLS --------------------------------------------------------------------

drop policy categories_select_own   on public.categories;
drop policy categories_insert_own   on public.categories;
drop policy categories_delete_own   on public.categories;
drop policy transactions_select_own on public.transactions;
drop policy transactions_insert_own on public.transactions;
drop policy transactions_update_own on public.transactions;
drop policy transactions_delete_own on public.transactions;
drop policy debts_select_own on public.debts;
drop policy debts_insert_own on public.debts;
drop policy debts_update_own on public.debts;
drop policy debts_delete_own on public.debts;

-- Moliya: faqat biznesning faol egasi.
create policy categories_owner_select on public.categories
  for select to authenticated using (public.is_business_owner(business_id));
create policy categories_owner_insert on public.categories
  for insert to authenticated
  with check (public.is_business_owner(business_id) and user_id = (select auth.uid()));
create policy categories_owner_delete on public.categories
  for delete to authenticated using (public.is_business_owner(business_id));

create policy transactions_owner_select on public.transactions
  for select to authenticated using (public.is_business_owner(business_id));
create policy transactions_owner_insert on public.transactions
  for insert to authenticated
  with check (public.is_business_owner(business_id) and user_id = (select auth.uid()));
create policy transactions_owner_update on public.transactions
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
create policy transactions_owner_delete on public.transactions
  for delete to authenticated using (public.is_business_owner(business_id));

create policy debts_owner_select on public.debts
  for select to authenticated using (public.is_business_owner(business_id));
create policy debts_owner_insert on public.debts
  for insert to authenticated
  with check (public.is_business_owner(business_id) and user_id = (select auth.uid()));
create policy debts_owner_update on public.debts
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
create policy debts_owner_delete on public.debts
  for delete to authenticated using (public.is_business_owner(business_id));

-- Biznes va a'zolar: o'qish — RLS, o'zgartirish — faqat RPC orqali.
alter table public.businesses       enable row level security;
alter table public.business_members enable row level security;

create policy business_members_select on public.business_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_business_owner(business_id));

-- Kutilayotgan a'zo ham biznes nomini ko'radi ("So'rov yuborildi: …").
create policy businesses_select_member on public.businesses
  for select to authenticated
  using (
    exists (
      select 1 from public.business_members m
      where m.business_id = businesses.id and m.user_id = (select auth.uid())
    )
  );

-- Egasi o'z jamoasidagilarning ismini ko'radi.
create policy users_select_team on public.users
  for select to authenticated
  using (
    exists (
      select 1 from public.business_members m
      where m.user_id = users.id and public.is_business_owner(m.business_id)
    )
  );

revoke all on public.businesses, public.business_members, public.balances from anon, authenticated;
grant select on public.businesses, public.business_members, public.balances to authenticated;


-- 7. Ro'yxatdan o'tish: kategoriyalar endi biznes yaratilganda qo'shiladi --

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, full_name)
  values (
    new.id,
    left(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 100)
  );
  return new;
end;
$$;


-- 8. Qarzni to'lash — biznes kategoriyalari bilan --------------------------

create or replace function public.pay_debt(
  p_debt_id uuid,
  p_payment_method public.payment_method,
  p_paid_at timestamptz default now()
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_type public.transaction_type;
  v_category_name text;
  v_category_id uuid;
  v_transaction_id uuid;
begin
  select * into v_debt from public.debts where id = p_debt_id for update;
  if not found then
    raise exception 'debt not found' using errcode = 'P0002';
  end if;
  if v_debt.paid_at is not null then
    return;
  end if;

  if v_debt.direction = 'payable' then
    v_type := 'expense';
    v_category_name := 'Kompaniya berishi kerak bo''lgan qarzlar';
  else
    v_type := 'income';
    v_category_name := 'Kompaniyadan mijozlar qarzlari';
  end if;

  select id into v_category_id
  from public.categories
  where business_id = v_debt.business_id and type = v_type and lower(name) = lower(v_category_name);

  if v_category_id is null then
    insert into public.categories (business_id, name, type)
    values (v_debt.business_id, v_category_name, v_type)
    returning id into v_category_id;
  end if;

  insert into public.transactions (business_id, category_id, type, amount, currency, payment_method, note, occurred_at)
  values (
    v_debt.business_id, v_category_id, v_type, v_debt.amount, v_debt.currency, p_payment_method,
    left(v_debt.counterparty || coalesce(' — ' || v_debt.note, ''), 500),
    p_paid_at
  )
  returning id into v_transaction_id;

  update public.debts
  set paid_at = p_paid_at, transaction_id = v_transaction_id
  where id = p_debt_id;
end;
$$;


-- 9. Jamoa RPC'lari ----------------------------------------------------------

create or replace function public.create_business(p_name text)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_business public.businesses;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.business_members where user_id = v_uid) then
    raise exception 'already a member of a business' using errcode = 'FB001';
  end if;

  insert into public.businesses (name, owner_id, join_code)
  values (btrim(p_name), v_uid, public.generate_join_code())
  returning * into v_business;

  insert into public.business_members (business_id, user_id, role, status)
  values (v_business.id, v_uid, 'owner', 'active');

  insert into public.categories (user_id, business_id, name, type)
  values
    (v_uid, v_business.id, 'Kompaniya berishi kerak bo''lgan qarzlar', 'expense'),
    (v_uid, v_business.id, 'Kompaniyadan mijozlar qarzlari', 'income');

  return v_business;
end;
$$;

create or replace function public.join_business(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_business_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from public.business_members where user_id = v_uid) then
    raise exception 'already a member of a business' using errcode = 'FB001';
  end if;

  select id into v_business_id
  from public.businesses
  where join_code = upper(btrim(p_code));
  if v_business_id is null then
    raise exception 'join code not found' using errcode = 'FB002';
  end if;

  insert into public.business_members (business_id, user_id, role, status)
  values (v_business_id, v_uid, 'seller', 'pending');
  return v_business_id;
end;
$$;

create or replace function public.approve_member(p_user_id uuid)
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
  update public.business_members
  set status = 'active'
  where business_id = v_business_id and user_id = p_user_id and role = 'seller';
  if not found then
    raise exception 'member not found' using errcode = 'FB005';
  end if;
end;
$$;

create or replace function public.remove_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := public.current_business_id();
  v_role public.member_role;
begin
  if v_business_id is null or not public.is_business_owner(v_business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  select role into v_role
  from public.business_members
  where business_id = v_business_id and user_id = p_user_id;
  if v_role is null then
    raise exception 'member not found' using errcode = 'FB005';
  end if;
  if v_role = 'owner' then
    raise exception 'the owner cannot be removed' using errcode = 'FB004';
  end if;
  delete from public.business_members
  where business_id = v_business_id and user_id = p_user_id;
end;
$$;

-- Sotuvchi biznesdan chiqadi yoki kutilayotgan so'rovini bekor qiladi.
create or replace function public.leave_business()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
begin
  select role into v_role from public.business_members where user_id = auth.uid();
  if v_role is null then
    raise exception 'member not found' using errcode = 'FB005';
  end if;
  if v_role = 'owner' then
    raise exception 'the owner cannot leave' using errcode = 'FB004';
  end if;
  delete from public.business_members where user_id = auth.uid();
end;
$$;

revoke all on function public.generate_join_code() from public, anon, authenticated;
revoke all on function public.current_business_id() from public, anon;
revoke all on function public.is_business_owner(uuid) from public, anon;
revoke all on function public.create_business(text) from public, anon;
revoke all on function public.join_business(text) from public, anon;
revoke all on function public.approve_member(uuid) from public, anon;
revoke all on function public.remove_member(uuid) from public, anon;
revoke all on function public.leave_business() from public, anon;

grant execute on function public.current_business_id() to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;
grant execute on function public.create_business(text) to authenticated;
grant execute on function public.join_business(text) to authenticated;
grant execute on function public.approve_member(uuid) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.leave_business() to authenticated;

commit;
