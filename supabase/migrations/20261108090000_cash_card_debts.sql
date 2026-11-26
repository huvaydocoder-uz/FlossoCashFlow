-- =====================================================================
-- CashFlow — 2-bosqich
--   1) Naqd / karta: har bir amalda to'lov usuli (payment_method)
--   2) balances view'i valyuta + to'lov usuli bo'yicha
--   3) Qarzlar (debts) jadvali: kompaniya qarzlari va mijozlar qarzlari
--   4) Ikki yangi kategoriya (barcha foydalanuvchilarga va yangilariga)
--   5) pay_debt / unpay_debt — qarzni to'langan deb belgilash (amal bilan birga)
-- =====================================================================


-- 1. Naqd / karta ---------------------------------------------------------

create type public.payment_method as enum ('cash', 'card');

alter table public.transactions
  add column payment_method public.payment_method not null default 'cash';


-- 2. balances — valyuta va to'lov usuli bo'yicha -------------------------
-- Eski ustunlar o'z joyida qoladi, payment_method oxiriga qo'shiladi.

create or replace view public.balances
with (security_invoker = on) as
select
  user_id,
  currency,
  coalesce(sum(amount) filter (where type = 'income'), 0)  as total_income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
  sum(case when type = 'income' then amount else -amount end) as balance,
  payment_method
from public.transactions
group by user_id, currency, payment_method;


-- 3. Qarzlar --------------------------------------------------------------
-- payable    — kompaniya boshqalarga berishi kerak bo'lgan qarz
-- receivable — mijozlarning kompaniyaga qarzi

create type public.debt_direction as enum ('payable', 'receivable');

create table public.debts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid()
                  references public.users (id) on delete cascade,
  direction       public.debt_direction not null,
  counterparty    text not null
                  check (counterparty = btrim(counterparty) and char_length(counterparty) between 1 and 100),
  amount          numeric(18, 2) not null check (amount > 0),
  currency        public.currency_code not null,
  due_date        date not null,
  note            text check (note is null or char_length(note) <= 500),
  paid_at         timestamptz,
  transaction_id  uuid references public.transactions (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index debts_user_due_idx on public.debts (user_id, due_date);

create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

alter table public.debts enable row level security;

create policy debts_select_own on public.debts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy debts_insert_own on public.debts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy debts_update_own on public.debts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy debts_delete_own on public.debts
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.debts from anon, authenticated;
grant select, insert, update, delete on public.debts to authenticated;
grant select on public.balances to authenticated;


-- 4. Qarz kategoriyalari ----------------------------------------------------
-- Kompaniya qarzini to'lasa — chiqim; mijoz qarzini qaytarsa — kirim.

insert into public.categories (user_id, name, type)
select u.id, c.name, c.type::public.transaction_type
from public.users u
cross join (values
  ('Kompaniya berishi kerak bo''lgan qarzlar', 'expense'),
  ('Kompaniyadan mijozlar qarzlari', 'income')
) as c (name, type)
on conflict do nothing;

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
  insert into public.categories (user_id, name, type)
  values
    (new.id, 'Kompaniya berishi kerak bo''lgan qarzlar', 'expense'),
    (new.id, 'Kompaniyadan mijozlar qarzlari', 'income');
  return new;
end;
$$;


-- 5. Qarzni to'lash / to'lovni bekor qilish --------------------------------
-- security invoker: RLS amal qiladi, foydalanuvchi faqat o'z qarzini to'laydi.

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
  where user_id = v_debt.user_id and type = v_type and lower(name) = lower(v_category_name);

  if v_category_id is null then
    insert into public.categories (user_id, name, type)
    values (v_debt.user_id, v_category_name, v_type)
    returning id into v_category_id;
  end if;

  insert into public.transactions (user_id, category_id, type, amount, currency, payment_method, note, occurred_at)
  values (
    v_debt.user_id, v_category_id, v_type, v_debt.amount, v_debt.currency, p_payment_method,
    left(v_debt.counterparty || coalesce(' — ' || v_debt.note, ''), 500),
    p_paid_at
  )
  returning id into v_transaction_id;

  update public.debts
  set paid_at = p_paid_at, transaction_id = v_transaction_id
  where id = p_debt_id;
end;
$$;

create or replace function public.unpay_debt(p_debt_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_transaction_id uuid;
begin
  select transaction_id into v_transaction_id from public.debts where id = p_debt_id for update;
  if not found then
    raise exception 'debt not found' using errcode = 'P0002';
  end if;
  update public.debts set paid_at = null, transaction_id = null where id = p_debt_id;
  if v_transaction_id is not null then
    delete from public.transactions where id = v_transaction_id;
  end if;
end;
$$;

revoke all on function public.pay_debt(uuid, public.payment_method, timestamptz) from public, anon;
revoke all on function public.unpay_debt(uuid) from public, anon;
grant execute on function public.pay_debt(uuid, public.payment_method, timestamptz) to authenticated;
grant execute on function public.unpay_debt(uuid) to authenticated;
