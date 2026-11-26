-- =====================================================================
-- CashFlow — xodimlar va oylik
--   1) employees: ism, telefon, lavozim; oylik turi — belgilangan (kunga
--      proporsional) yoki foiz (pog'onali plan); sotuvchi akkauntiga bog'lanadi
--   2) commission_tiers: "from_usd dan boshlab — percent %" (butun savdoga)
--   3) payroll_days: oy bo'yicha ishlagan kunlar
--   4) salary_payments: avans/oylik — kassaga "Oylik" chiqimi
--   5) payroll(p_month): hisoblangan / berilgan / qoldiq — bitta joyda
--   6) payroll_snapshots: pul berilgan oy sozlamalari muhrlanadi — keyin oylik
--      summasi yoki plan o'zgarsa, o'tgan oylar qayta hisoblanmaydi
--   7) save_employee: xodim va pog'onali plan bitta tranzaksiyada
-- Xato kodlari: FE001 oylik berilgan xodim o'chmaydi, FE002 to'lovi bor xodimning
-- oylik turi/valyutasi o'zgarmaydi, FE003 bog'langan akkaunt jamoa a'zosi emas.
-- =====================================================================

begin;


-- 1. Turlar va jadvallar ---------------------------------------------------------

create type public.employee_pay_type as enum ('fixed', 'commission');
create type public.salary_payment_kind as enum ('advance', 'salary');

create table public.employees (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null default public.current_business_id()
                   references public.businesses (id) on delete cascade,
  full_name        text not null
                   check (full_name = btrim(full_name) and char_length(full_name) between 1 and 100),
  phone            text check (phone is null or (char_length(phone) <= 20 and phone ~ '^[+0-9 ()-]*$')),
  position         text check (position is null or char_length(position) <= 60),
  pay_type         public.employee_pay_type not null,
  fixed_salary     numeric(18, 2) check (fixed_salary is null or fixed_salary >= 0),
  salary_currency  public.currency_code not null default 'UZS',
  norm_days        integer not null default 25 check (norm_days between 1 and 31),
  member_user_id   uuid references public.users (id) on delete set null,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint employees_business_member_key unique (business_id, member_user_id)
);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

create table public.commission_tiers (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  from_usd     numeric(18, 2) not null check (from_usd >= 0),
  percent      numeric(5, 2) not null check (percent between 0 and 100),
  constraint commission_tiers_employee_from_key unique (employee_id, from_usd)
);

create table public.payroll_days (
  employee_id  uuid not null references public.employees (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  days_worked  integer not null check (days_worked between 0 and 31),
  primary key (employee_id, month)
);

create table public.salary_payments (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees (id) on delete restrict,
  business_id       uuid not null references public.businesses (id) on delete cascade,
  month             date not null check (extract(day from month) = 1),
  amount            numeric(18, 2) not null check (amount > 0),
  currency          public.currency_code not null,
  -- Oylik valyutasidan boshqa valyutada berilsa — o'sha kungi kurs (1 $ = N so'm).
  rate_uzs_per_usd  numeric(12, 2) check (rate_uzs_per_usd is null or rate_uzs_per_usd between 5000 and 50000),
  payment_method    public.payment_method not null,
  kind              public.salary_payment_kind not null,
  paid_at           timestamptz not null default now(),
  paid_by           uuid default auth.uid() references public.users (id) on delete set null,
  transaction_id    uuid references public.transactions (id) on delete set null,
  created_at        timestamptz not null default now()
);

create index salary_payments_employee_month_idx on public.salary_payments (employee_id, month);

-- Oy sozlamalari muhri: shu oyda pul berilganda yoziladi (har to'lovda yangilanadi).
create table public.payroll_snapshots (
  employee_id      uuid not null references public.employees (id) on delete cascade,
  business_id      uuid not null references public.businesses (id) on delete cascade,
  month            date not null check (extract(day from month) = 1),
  pay_type         public.employee_pay_type not null,
  fixed_salary     numeric(18, 2),
  salary_currency  public.currency_code not null,
  norm_days        integer not null,
  tiers            jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),
  primary key (employee_id, month)
);

alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('manual', 'debt_origin', 'debt_payment', 'order_payment', 'salary_payment'));


-- 2. Yordamchilar ---------------------------------------------------------------

-- Xodimni ko'rish: biznes egasi yoki xodimga bog'langan akkaunt (sotuvchi o'zini).
create or replace function public.can_view_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.id = p_employee_id
      and e.business_id = public.current_business_id()
      and (public.is_business_owner(e.business_id) or e.member_user_id = auth.uid())
  )
$$;

-- Hisoblangan oylik qaysi valyutada: belgilangan — xodim valyutasida, foiz — $ da.
create or replace function public.salary_currency_of(p_pay_type public.employee_pay_type, p_currency public.currency_code)
returns public.currency_code
language sql
immutable
set search_path = ''
as $$
  select case when p_pay_type = 'fixed' then p_currency else 'USD'::public.currency_code end
$$;


-- 3. Trigger'lar ------------------------------------------------------------------

create or replace function public.prepare_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.salary_payments where employee_id = old.id) then
      raise exception 'employee has salary payments' using errcode = 'FE001';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.business_id := old.business_id;
    new.created_at := old.created_at;
    if public.salary_currency_of(new.pay_type, new.salary_currency)
         <> public.salary_currency_of(old.pay_type, old.salary_currency)
       and exists (select 1 from public.salary_payments where employee_id = old.id) then
      raise exception 'employee with payments cannot change salary currency' using errcode = 'FE002';
    end if;
  end if;

  if new.member_user_id is not null
     and (tg_op = 'INSERT' or new.member_user_id is distinct from old.member_user_id)
     and not exists (
       select 1 from public.business_members
       where business_id = new.business_id and user_id = new.member_user_id and status = 'active'
     ) then
    raise exception 'linked account is not a team member' using errcode = 'FE003';
  end if;
  return new;
end;
$$;

create trigger employees_prepare
  before insert or update or delete on public.employees
  for each row execute function public.prepare_employee();

-- Pog'ona va kunlar doim o'z xodimining biznesida; xodim almashtirilmaydi.
create or replace function public.prepare_employee_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.employee_id := old.employee_id;
  end if;
  select business_id into new.business_id from public.employees where id = new.employee_id;
  return new;
end;
$$;

create trigger commission_tiers_prepare
  before insert or update on public.commission_tiers
  for each row execute function public.prepare_employee_child();

create trigger payroll_days_prepare
  before insert or update on public.payroll_days
  for each row execute function public.prepare_employee_child();


-- 4. RLS --------------------------------------------------------------------------

alter table public.employees        enable row level security;
alter table public.commission_tiers enable row level security;
alter table public.payroll_days     enable row level security;
alter table public.salary_payments  enable row level security;
alter table public.payroll_snapshots enable row level security;

create policy payroll_snapshots_select on public.payroll_snapshots
  for select to authenticated using (public.can_view_employee(employee_id));

create policy employees_select on public.employees
  for select to authenticated
  using (
    business_id = public.current_business_id()
    and (public.is_business_owner(business_id) or member_user_id = (select auth.uid()))
  );
create policy employees_insert on public.employees
  for insert to authenticated
  with check (business_id = public.current_business_id() and public.is_business_owner(business_id));
create policy employees_update on public.employees
  for update to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));
create policy employees_delete on public.employees
  for delete to authenticated
  using (public.is_business_owner(business_id));

create policy commission_tiers_select on public.commission_tiers
  for select to authenticated using (public.can_view_employee(employee_id));
create policy commission_tiers_write on public.commission_tiers
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy payroll_days_select on public.payroll_days
  for select to authenticated using (public.can_view_employee(employee_id));
create policy payroll_days_write on public.payroll_days
  for all to authenticated
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

create policy salary_payments_select on public.salary_payments
  for select to authenticated using (public.can_view_employee(employee_id));

revoke all on public.employees, public.commission_tiers, public.payroll_days, public.salary_payments,
  public.payroll_snapshots from anon, authenticated;
grant select on public.payroll_snapshots to authenticated;
grant select, insert, update, delete on public.employees, public.commission_tiers, public.payroll_days
  to authenticated;
grant select on public.salary_payments to authenticated;


-- 5. Oylik hisobi -----------------------------------------------------------------
-- Belgilangan: oylik ÷ me'yor × ishlagan kun. Foiz: shu oyda buyurtma qilingan o'z
-- buyurtmalariga amalda to'langan pul ($, bekor qilinganlar kirmaydi) × pog'ona foizi.

create or replace function public.payroll(p_month date)
returns table (
  employee_id        uuid,
  full_name          text,
  phone              text,
  "position"         text,
  pay_type           public.employee_pay_type,
  member_user_id     uuid,
  active             boolean,
  fixed_salary       numeric,
  salary_currency    public.currency_code,
  norm_days          integer,
  days_worked        integer,
  sales_usd          numeric,
  percent            numeric,
  next_tier_from     numeric,
  next_tier_percent  numeric,
  computed           numeric,
  computed_currency  public.currency_code,
  paid               numeric,
  remaining          numeric,
  overpaid           numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with period as (
    select date_trunc('month', p_month)::date as m,
           (date_trunc('month', p_month) + interval '1 month')::date as m_next
  )
  select
    e.id, e.full_name, e.phone, e.position, cfg.pay_type, e.member_user_id, e.active,
    cfg.fixed_salary, cfg.salary_currency, cfg.norm_days,
    d.days, s.usd, t.percent, nt.from_usd, nt.percent,
    c.amount, c.currency, p.paid,
    -- Boshqa valyutadagi to'lov sentgacha aniq bo'lmaydi: bir sentdan kam farq — nol.
    case when c.amount - p.paid <= p.tolerance then 0 else c.amount - p.paid end,
    case when p.paid - c.amount <= p.tolerance then 0 else p.paid - c.amount end
  from public.employees e
  cross join period
  left join public.payroll_snapshots sn on sn.employee_id = e.id and sn.month = period.m
  -- Pul berilgan oy — muhrdagi sozlamalar; aks holda joriy sozlamalar.
  cross join lateral (
    select
      case when sn.employee_id is null then e.pay_type else sn.pay_type end as pay_type,
      case when sn.employee_id is null then e.fixed_salary else sn.fixed_salary end as fixed_salary,
      case when sn.employee_id is null then e.salary_currency else sn.salary_currency end as salary_currency,
      case when sn.employee_id is null then e.norm_days else sn.norm_days end as norm_days,
      case when sn.employee_id is null then (
        select coalesce(jsonb_agg(jsonb_build_object('from_usd', ct.from_usd, 'percent', ct.percent)), '[]'::jsonb)
        from public.commission_tiers ct where ct.employee_id = e.id
      ) else sn.tiers end as tiers
  ) cfg
  cross join lateral (
    select coalesce((
      select pd.days_worked from public.payroll_days pd
      where pd.employee_id = e.id and pd.month = period.m
    ), 0) as days
  ) d
  cross join lateral (
    select case
      when cfg.pay_type = 'commission' and e.member_user_id is not null then coalesce((
        select sum(op.amount_usd)
        from public.orders o
        join public.order_payments op on op.order_id = o.id
        where o.business_id = e.business_id
          and o.seller_id = e.member_user_id
          and o.status <> 'cancelled'
          and o.order_date >= period.m and o.order_date < period.m_next
      ), 0)
      else 0
    end as usd
  ) s
  cross join lateral (
    select coalesce((
      select (x->>'percent')::numeric from jsonb_array_elements(cfg.tiers) x
      where (x->>'from_usd')::numeric <= s.usd
      order by (x->>'from_usd')::numeric desc limit 1
    ), 0) as percent
  ) t
  left join lateral (
    select (x->>'from_usd')::numeric as from_usd, (x->>'percent')::numeric as percent
    from jsonb_array_elements(cfg.tiers) x
    where (x->>'from_usd')::numeric > s.usd
    order by (x->>'from_usd')::numeric limit 1
  ) nt on true
  cross join lateral (
    select
      case when cfg.pay_type = 'fixed'
        then round(coalesce(cfg.fixed_salary, 0) * d.days / cfg.norm_days, 2)
        else round(s.usd * t.percent / 100, 2)
      end as amount,
      public.salary_currency_of(cfg.pay_type, cfg.salary_currency) as currency
  ) c
  cross join lateral (
    select coalesce(round(sum(public.to_order_currency(
      sp.amount, sp.currency, c.currency, coalesce(sp.rate_uzs_per_usd, 1)
    )), 2), 0) as paid,
    coalesce(max(case when sp.currency <> c.currency
      then public.to_order_currency(0.01, sp.currency, c.currency, sp.rate_uzs_per_usd) end), 0) as tolerance
    from public.salary_payments sp
    where sp.employee_id = e.id and sp.month = period.m
  ) p
  where e.business_id = public.current_business_id()
    and (public.is_business_owner(e.business_id) or e.member_user_id = auth.uid())
  order by e.active desc, e.full_name
$$;


-- 6. To'lov RPC'lari ----------------------------------------------------------------

create or replace function public.add_salary_payment(
  p_employee_id uuid,
  p_month date,
  p_amount numeric,
  p_currency public.currency_code,
  p_payment_method public.payment_method,
  p_rate numeric,
  p_kind public.salary_payment_kind,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees;
  v_month date := date_trunc('month', p_month)::date;
  v_amount numeric := round(p_amount, 2);
  v_rate numeric := round(p_rate, 2);
  v_transaction_id uuid;
  v_payment_id uuid;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if not found or not public.is_business_owner(v_employee.business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  if v_amount is null or v_amount <= 0 or v_month is null then
    raise exception 'amount must be positive' using errcode = '23514';
  end if;
  if p_currency = public.salary_currency_of(v_employee.pay_type, v_employee.salary_currency) then
    v_rate := null;
  elsif v_rate is null or v_rate < 5000 or v_rate > 50000 then
    raise exception 'exchange rate is not realistic' using errcode = 'FO003';
  end if;

  insert into public.transactions
    (user_id, business_id, category_id, type, amount, currency, payment_method, note, occurred_at, source)
  values
    (auth.uid(), v_employee.business_id,
     public.debt_category_id(v_employee.business_id, 'expense', 'Oylik', auth.uid()),
     'expense', v_amount, p_currency, p_payment_method,
     left(v_employee.full_name || ' — ' || to_char(v_month, 'MM.YYYY')
          || case when p_kind = 'advance' then ' (avans)' else '' end, 500),
     coalesce(p_paid_at, now()), 'salary_payment')
  returning id into v_transaction_id;

  insert into public.salary_payments
    (employee_id, business_id, month, amount, currency, rate_uzs_per_usd, payment_method, kind, paid_at, paid_by, transaction_id)
  values
    (v_employee.id, v_employee.business_id, v_month, v_amount, p_currency, v_rate, p_payment_method, p_kind,
     coalesce(p_paid_at, now()), auth.uid(), v_transaction_id)
  returning id into v_payment_id;

  -- Shu oy sozlamalarini muhrlaymiz: keyin oylik yoki plan o'zgarsa, bu oy o'zgarmaydi.
  insert into public.payroll_snapshots
    (employee_id, business_id, month, pay_type, fixed_salary, salary_currency, norm_days, tiers)
  values (
    v_employee.id, v_employee.business_id, v_month, v_employee.pay_type, v_employee.fixed_salary,
    v_employee.salary_currency, v_employee.norm_days,
    (select coalesce(jsonb_agg(jsonb_build_object('from_usd', ct.from_usd, 'percent', ct.percent)), '[]'::jsonb)
     from public.commission_tiers ct where ct.employee_id = v_employee.id)
  )
  on conflict (employee_id, month) do update
  set pay_type = excluded.pay_type,
      fixed_salary = excluded.fixed_salary,
      salary_currency = excluded.salary_currency,
      norm_days = excluded.norm_days,
      tiers = excluded.tiers,
      updated_at = now();

  return v_payment_id;
end;
$$;

create or replace function public.delete_salary_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.salary_payments;
begin
  select * into v_payment from public.salary_payments where id = p_payment_id;
  if not found or not public.is_business_owner(v_payment.business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  delete from public.salary_payments where id = p_payment_id;
  if v_payment.transaction_id is not null then
    delete from public.transactions where id = v_payment.transaction_id;
  end if;
end;
$$;

-- Xodim va pog'onali plan bitta tranzaksiyada (yarim saqlanib qolmaydi).
create or replace function public.save_employee(p_id uuid, p_employee jsonb, p_tiers jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid := public.current_business_id();
  v_row public.employees := jsonb_populate_record(null::public.employees, p_employee);
  v_id uuid;
begin
  if v_business_id is null or not public.is_business_owner(v_business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;

  if p_id is null then
    insert into public.employees
      (business_id, full_name, phone, position, pay_type, fixed_salary, salary_currency, norm_days, member_user_id, active)
    values
      (v_business_id, v_row.full_name, v_row.phone, v_row.position, v_row.pay_type, v_row.fixed_salary,
       coalesce(v_row.salary_currency, 'UZS'), coalesce(v_row.norm_days, 25), v_row.member_user_id,
       coalesce(v_row.active, true))
    returning id into v_id;
  else
    update public.employees
    set full_name = v_row.full_name,
        phone = v_row.phone,
        position = v_row.position,
        pay_type = v_row.pay_type,
        fixed_salary = v_row.fixed_salary,
        salary_currency = coalesce(v_row.salary_currency, salary_currency),
        norm_days = coalesce(v_row.norm_days, norm_days),
        member_user_id = v_row.member_user_id,
        active = coalesce(v_row.active, active)
    where id = p_id and business_id = v_business_id
    returning id into v_id;
    if v_id is null then
      raise exception 'only the owner can do this' using errcode = 'FB003';
    end if;
  end if;

  delete from public.commission_tiers where employee_id = v_id;
  if v_row.pay_type = 'commission' then
    insert into public.commission_tiers (employee_id, business_id, from_usd, percent)
    select v_id, v_business_id, x.from_usd, x.percent
    from jsonb_to_recordset(coalesce(p_tiers, '[]'::jsonb)) as x(from_usd numeric, percent numeric);
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_employee(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_employee(uuid, jsonb, jsonb) to authenticated;
revoke all on function public.salary_currency_of(public.employee_pay_type, public.currency_code) from public, anon;

revoke all on function public.can_view_employee(uuid) from public, anon;
revoke all on function public.prepare_employee() from public, anon, authenticated;
revoke all on function public.prepare_employee_child() from public, anon, authenticated;
revoke all on function public.payroll(date) from public, anon;
revoke all on function public.add_salary_payment(uuid, date, numeric, public.currency_code, public.payment_method, numeric, public.salary_payment_kind, timestamptz) from public, anon;
revoke all on function public.delete_salary_payment(uuid) from public, anon;
grant execute on function public.can_view_employee(uuid) to authenticated;
grant execute on function public.salary_currency_of(public.employee_pay_type, public.currency_code) to authenticated;
grant execute on function public.payroll(date) to authenticated;
grant execute on function public.add_salary_payment(uuid, date, numeric, public.currency_code, public.payment_method, numeric, public.salary_payment_kind, timestamptz) to authenticated;
grant execute on function public.delete_salary_payment(uuid) to authenticated;

commit;
