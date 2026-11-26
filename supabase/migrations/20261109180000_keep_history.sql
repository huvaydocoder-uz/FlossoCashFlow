-- =====================================================================
-- CashFlow — xodimlar almashganda tarix saqlanadi
--   1) Akkaunt o'chirilsa: kassa amallari, kategoriyalar va qarzlar o'chmaydi
--      (user_id — "kim yozgan", null bo'lib qoladi)
--   2) Buyurtmada sotuvchi ismi muhrlanadi; akkaunt o'chsa seller_id null bo'ladi,
--      ismi qoladi (buyurtmalar ro'yxati va sotuv hisobotida)
--   3) Oylik berilgan xodim "o'chirilganda" arxivlanadi (deleted_at): to'lovlari,
--      kassa amallari va o'tgan oylardagi hisobi saqlanadi; akkaunti yangi kartaga
--      bog'lanishi mumkin; oxirgi to'lovi o'chsa — xodim ham o'chadi
--   4) Foizli oylik: pul berilgan oyning savdosi muhrlanadi (sotuvchi ketsa ham)
-- =====================================================================

begin;


-- 1. "Kim yozgan" havolalari: cascade -> set null ---------------------------------

alter table public.transactions alter column user_id drop not null;
alter table public.transactions drop constraint transactions_user_id_fkey;
alter table public.transactions
  add constraint transactions_user_id_fkey
  foreign key (user_id) references public.users (id) on delete set null;

alter table public.categories alter column user_id drop not null;
alter table public.categories drop constraint categories_user_id_fkey;
alter table public.categories
  add constraint categories_user_id_fkey
  foreign key (user_id) references public.users (id) on delete set null;

alter table public.debts alter column user_id drop not null;
alter table public.debts drop constraint debts_user_id_fkey;
alter table public.debts
  add constraint debts_user_id_fkey
  foreign key (user_id) references public.users (id) on delete set null;


-- 2. Buyurtmada sotuvchi ismi -----------------------------------------------------

alter table public.orders add column seller_name text;

update public.orders o set seller_name = u.full_name from public.users u where u.id = o.seller_id;

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
    -- Sotuvchi o'zgarmaydi; faqat akkaunti o'chirilganda (FK kaskadi) null bo'ladi.
    if not v_is_owner and not (new.seller_id is null and pg_trigger_depth() > 1) then
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

create or replace function public.stamp_order_seller_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.seller_id is distinct from old.seller_id then
    -- Akkaunt o'chib seller_id null bo'lsa — eski ism saqlanadi.
    new.seller_name := coalesce(
      (select full_name from public.users where id = new.seller_id),
      case when tg_op = 'UPDATE' and new.seller_id is null then old.seller_name end
    );
  else
    new.seller_name := old.seller_name;
  end if;
  return new;
end;
$$;

-- prepare_order dan keyin ishlaydi (nomlar alifbo tartibida: orders_prepare < orders_seller_name).
create trigger orders_seller_name
  before insert or update on public.orders
  for each row execute function public.stamp_order_seller_name();

revoke all on function public.stamp_order_seller_name() from public, anon, authenticated;

create or replace view public.order_list as
select
  o.id,
  o.business_id,
  o.number,
  o.seller_id,
  coalesce(u.full_name, o.seller_name) as seller_name,
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
    coalesce(u.full_name, o.seller_name),
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
  group by 1, o.seller_id, coalesce(u.full_name, o.seller_name)
  order by 1 desc, 3;
end;
$$;


-- 3. Xodimni o'chirish — arxivlash ---------------------------------------------------

alter table public.employees add column deleted_at timestamptz;

-- Bitta akkaunt — bitta faol (o'chirilmagan) xodim kartasi.
alter table public.employees drop constraint employees_business_member_key;
create unique index employees_business_member_active_key
  on public.employees (business_id, member_user_id)
  where deleted_at is null;

alter table public.payroll_snapshots add column sales_usd numeric(18, 2);

create or replace function public.prepare_employee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- Oylik berilgan xodim o'chirilmaydi — arxivlanadi: to'lovlari, kassa amallari va
    -- o'tgan oylardagi hisobi saqlanadi. Biznesning o'zi o'chirilayotgan bo'lsa — o'chadi.
    if exists (select 1 from public.salary_payments where employee_id = old.id)
       and exists (select 1 from public.businesses where id = old.business_id) then
      update public.employees set active = false, deleted_at = now() where id = old.id;
      return null;
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
      -- Akkaunti o'chirilgan sotuvchi — pul berilgan oyda muhrlangan savdo.
      when cfg.pay_type = 'commission' and e.member_user_id is null then coalesce(sn.sales_usd, 0)
      when cfg.pay_type = 'commission' then coalesce((
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
    -- O'chirilgan xodim — o'chirilgan oyigacha va pul berilgan oylarda ko'rinadi.
    and (
      e.deleted_at is null
      or period.m <= date_trunc('month', e.deleted_at)::date
      or exists (select 1 from public.salary_payments sp0 where sp0.employee_id = e.id and sp0.month = period.m)
    )
  order by e.active desc, e.full_name
$$;

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
    (employee_id, business_id, month, pay_type, fixed_salary, salary_currency, norm_days, tiers, sales_usd)
  values (
    v_employee.id, v_employee.business_id, v_month, v_employee.pay_type, v_employee.fixed_salary,
    v_employee.salary_currency, v_employee.norm_days,
    (select coalesce(jsonb_agg(jsonb_build_object('from_usd', ct.from_usd, 'percent', ct.percent)), '[]'::jsonb)
     from public.commission_tiers ct where ct.employee_id = v_employee.id),
    -- Shu oydagi savdo: sotuvchi keyin ketsa ham o'tgan oylardagi foiz saqlanadi.
    (select coalesce(sum(op.amount_usd), 0)
     from public.orders o
     join public.order_payments op on op.order_id = o.id
     where v_employee.member_user_id is not null
       and o.business_id = v_employee.business_id
       and o.seller_id = v_employee.member_user_id
       and o.status <> 'cancelled'
       and o.order_date >= v_month and o.order_date < (v_month + interval '1 month'))
  )
  on conflict (employee_id, month) do update
  set pay_type = excluded.pay_type,
      fixed_salary = excluded.fixed_salary,
      salary_currency = excluded.salary_currency,
      norm_days = excluded.norm_days,
      tiers = excluded.tiers,
      sales_usd = excluded.sales_usd,
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
  -- O'chirilgan (arxivlangan) xodimning oxirgi to'lovi ham o'chsa — xodim ham o'chadi.
  delete from public.employees e
  where e.id = v_payment.employee_id
    and e.deleted_at is not null
    and not exists (select 1 from public.salary_payments sp where sp.employee_id = e.id);
end;
$$;

commit;
