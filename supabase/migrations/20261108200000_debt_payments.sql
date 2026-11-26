-- =====================================================================
-- CashFlow — 4-bosqich: qarzlarni bo'lib to'lash
--   1) debts: telefon, soha, "pul qanday o'tdi" (naqd / karta / nasiya = null)
--   2) debt_payments: har bir to'lov alohida, kassaga avtomatik amal bilan
--   3) transactions.source / debt_id: avtomatik amallar qo'lda o'zgartirilmaydi
--   4) Trigger: qarz qo'shilganda/tahrirlanganda boshlang'ich amal sinxron,
--      qoldiq 0 bo'lsa paid_at qo'yiladi
--   5) RPC: add_debt_payment, delete_debt_payment; pay_debt/unpay_debt — eski
--      ilova uchun moslik
-- Xato kodlari: FD001 qoldiqdan ortiq to'lov, FD002 summa to'langandan kam,
-- FD003 to'lovi bor qarzning valyutasi/turi o'zgarmaydi.
-- =====================================================================

begin;


-- 1. Yangi ustunlar ---------------------------------------------------------

alter table public.debts
  add column phone text
    check (phone is null or (char_length(phone) <= 20 and phone ~ '^[+0-9 ()-]*$')),
  add column sector text
    check (sector is null or (sector = btrim(sector) and char_length(sector) between 1 and 50)),
  add column origin_method public.payment_method,
  -- Kechiktirilgan tekshiruv: trigger amalni o'chirib, havolani o'sha zahoti tozalaydi.
  add column origin_transaction_id uuid
    references public.transactions (id) deferrable initially deferred;

alter table public.transactions
  add column source text not null default 'manual'
    check (source in ('manual', 'debt_origin', 'debt_payment')),
  -- Qarz o'chirilsa, unga bog'liq barcha kassa amallari ham o'chadi.
  add column debt_id uuid
    references public.debts (id) on delete cascade deferrable initially deferred;

create index transactions_debt_idx on public.transactions (debt_id) where debt_id is not null;


-- 2. To'lovlar ----------------------------------------------------------------

create table public.debt_payments (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null default public.current_business_id()
                  references public.businesses (id) on delete cascade,
  debt_id         uuid not null references public.debts (id) on delete cascade,
  user_id         uuid default auth.uid() references public.users (id) on delete set null,
  amount          numeric(18, 2) not null check (amount > 0),
  payment_method  public.payment_method not null,
  paid_at         timestamptz not null default now(),
  transaction_id  uuid references public.transactions (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index debt_payments_debt_idx on public.debt_payments (debt_id);

-- Eski usulda to'langan qarzlar — bitta to'lov sifatida.
insert into public.debt_payments (business_id, debt_id, user_id, amount, payment_method, paid_at, transaction_id)
select d.business_id, d.id, d.user_id, d.amount, coalesce(t.payment_method, 'cash'), d.paid_at, d.transaction_id
from public.debts d
left join public.transactions t on t.id = d.transaction_id
where d.paid_at is not null;

update public.transactions t
set source = 'debt_payment', debt_id = d.id
from public.debts d
where d.transaction_id = t.id;

-- Eski havola endi debt_payments da.
update public.debts set transaction_id = null where transaction_id is not null;

alter table public.debt_payments enable row level security;

create policy debt_payments_owner_select on public.debt_payments
  for select to authenticated using (public.is_business_owner(business_id));

revoke all on public.debt_payments from anon, authenticated;
grant select on public.debt_payments to authenticated;


-- 3. Avtomatik amallar qo'lda o'zgartirilmaydi ------------------------------

drop policy transactions_owner_insert on public.transactions;
drop policy transactions_owner_update on public.transactions;
drop policy transactions_owner_delete on public.transactions;

create policy transactions_owner_insert on public.transactions
  for insert to authenticated
  with check (
    public.is_business_owner(business_id)
    and user_id = (select auth.uid())
    and source = 'manual'
    and debt_id is null
  );
create policy transactions_owner_update on public.transactions
  for update to authenticated
  using (public.is_business_owner(business_id) and source = 'manual')
  with check (public.is_business_owner(business_id) and source = 'manual' and debt_id is null);
create policy transactions_owner_delete on public.transactions
  for delete to authenticated
  using (public.is_business_owner(business_id) and source = 'manual');


-- 4. Yordamchi: biznesdagi qarz kategoriyasi (bo'lmasa yaratiladi) ----------

create or replace function public.debt_category_id(
  p_business_id uuid,
  p_type public.transaction_type,
  p_name text,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.categories
  where business_id = p_business_id and type = p_type and lower(name) = lower(p_name);
  if v_id is null then
    insert into public.categories (user_id, business_id, name, type)
    values (coalesce(auth.uid(), p_user_id), p_business_id, p_name, p_type)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;


-- 5. Trigger: boshlang'ich amal va paid_at ----------------------------------
-- RLS debts'ning o'zida tekshiriladi (faqat egasi qo'sha/o'zgartira oladi).

create or replace function public.sync_debt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paid numeric := 0;
  v_last_paid timestamptz;
  v_type public.transaction_type;
  v_category text;
  v_note text;
  -- SQL Editor / Dashboard orqali o'zgartirishda auth.uid() bo'sh — qarz egasi yoziladi.
  v_user uuid := coalesce(auth.uid(), new.user_id);
begin
  -- Havola faqat shu trigger tomonidan boshqariladi: mijoz yuborgan qiymat e'tiborga olinmaydi.
  if tg_op = 'INSERT' then
    new.origin_transaction_id := null;
  else
    new.origin_transaction_id := old.origin_transaction_id;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(amount), 0), max(paid_at) into v_paid, v_last_paid
    from public.debt_payments where debt_id = new.id;
    if v_paid > 0 and (new.currency <> old.currency or new.direction <> old.direction) then
      raise exception 'debt with payments cannot change currency or direction' using errcode = 'FD003';
    end if;
    if new.amount < v_paid then
      raise exception 'debt amount is below the paid total' using errcode = 'FD002';
    end if;
  end if;

  new.paid_at := case when v_paid > 0 and v_paid >= new.amount then v_last_paid end;

  if new.direction = 'payable' then
    v_type := 'income';
    v_category := 'Olingan qarzlar';
  else
    v_type := 'expense';
    v_category := 'Berilgan qarzlar';
  end if;
  v_note := left(new.counterparty || coalesce(' — ' || new.note, ''), 500);

  if new.origin_method is null then
    if new.origin_transaction_id is not null then
      delete from public.transactions
      where id = new.origin_transaction_id and debt_id = new.id and source = 'debt_origin';
      new.origin_transaction_id := null;
    end if;
  elsif new.origin_transaction_id is null then
    insert into public.transactions
      (user_id, business_id, category_id, type, amount, currency, payment_method, note, source, debt_id)
    values
      (v_user, new.business_id, public.debt_category_id(new.business_id, v_type, v_category, v_user),
       v_type, new.amount, new.currency, new.origin_method, v_note, 'debt_origin', new.id)
    returning id into new.origin_transaction_id;
  else
    update public.transactions
    set type = v_type,
        category_id = public.debt_category_id(new.business_id, v_type, v_category, v_user),
        amount = new.amount,
        currency = new.currency,
        payment_method = new.origin_method,
        note = v_note
    where id = new.origin_transaction_id and debt_id = new.id and source = 'debt_origin';
  end if;

  return new;
end;
$$;

create trigger debts_sync
  before insert or update on public.debts
  for each row execute function public.sync_debt();


-- 6. To'lov RPC'lari ---------------------------------------------------------

create or replace function public.add_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_amount numeric := round(p_amount, 2);
  v_paid numeric;
  v_type public.transaction_type;
  v_category text;
  v_transaction_id uuid;
  v_payment_id uuid;
begin
  select * into v_debt from public.debts where id = p_debt_id for update;
  if not found then
    raise exception 'debt not found' using errcode = 'P0002';
  end if;
  if not public.is_business_owner(v_debt.business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'payment must be positive' using errcode = '23514';
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.debt_payments where debt_id = p_debt_id;
  if v_amount > v_debt.amount - v_paid then
    raise exception 'payment exceeds the remaining debt' using errcode = 'FD001';
  end if;

  if v_debt.direction = 'payable' then
    v_type := 'expense';
    v_category := 'Kompaniya berishi kerak bo''lgan qarzlar';
  else
    v_type := 'income';
    v_category := 'Kompaniyadan mijozlar qarzlari';
  end if;

  insert into public.transactions
    (user_id, business_id, category_id, type, amount, currency, payment_method, note, occurred_at, source, debt_id)
  values
    (auth.uid(), v_debt.business_id, public.debt_category_id(v_debt.business_id, v_type, v_category),
     v_type, v_amount, v_debt.currency, p_payment_method,
     left(v_debt.counterparty || coalesce(' — ' || v_debt.note, ''), 500),
     p_paid_at, 'debt_payment', v_debt.id)
  returning id into v_transaction_id;

  insert into public.debt_payments (business_id, debt_id, user_id, amount, payment_method, paid_at, transaction_id)
  values (v_debt.business_id, v_debt.id, auth.uid(), v_amount, p_payment_method, p_paid_at, v_transaction_id)
  returning id into v_payment_id;

  -- Trigger paid_at ni qayta hisoblaydi.
  update public.debts set updated_at = now() where id = p_debt_id;
  return v_payment_id;
end;
$$;

create or replace function public.delete_debt_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.debt_payments;
begin
  select * into v_payment from public.debt_payments where id = p_payment_id;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;
  if not public.is_business_owner(v_payment.business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;

  delete from public.debt_payments where id = p_payment_id;
  if v_payment.transaction_id is not null then
    delete from public.transactions where id = v_payment.transaction_id;
  end if;
  update public.debts set updated_at = now() where id = v_payment.debt_id;
end;
$$;

-- Eski ilova uchun: "To'landi" — qoldiqni to'lash, "Bekor qilish" — barcha to'lovlarni o'chirish.
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
  v_remaining numeric;
begin
  select d.amount - coalesce((select sum(p.amount) from public.debt_payments p where p.debt_id = d.id), 0)
  into v_remaining
  from public.debts d
  where d.id = p_debt_id;
  if not found then
    raise exception 'debt not found' using errcode = 'P0002';
  end if;
  if v_remaining > 0 then
    perform public.add_debt_payment(p_debt_id, v_remaining, p_payment_method, p_paid_at);
  end if;
end;
$$;

create or replace function public.unpay_debt(p_debt_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r record;
begin
  perform 1 from public.debts where id = p_debt_id;
  if not found then
    raise exception 'debt not found' using errcode = 'P0002';
  end if;
  for r in select id from public.debt_payments where debt_id = p_debt_id loop
    perform public.delete_debt_payment(r.id);
  end loop;
end;
$$;

revoke all on function public.debt_category_id(uuid, public.transaction_type, text, uuid) from public, anon, authenticated;
revoke all on function public.sync_debt() from public, anon, authenticated;
revoke all on function public.add_debt_payment(uuid, numeric, public.payment_method, timestamptz) from public, anon;
revoke all on function public.delete_debt_payment(uuid) from public, anon;
grant execute on function public.add_debt_payment(uuid, numeric, public.payment_method, timestamptz) to authenticated;
grant execute on function public.delete_debt_payment(uuid) to authenticated;

commit;
