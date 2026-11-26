-- =====================================================================
-- CashFlow — qarz to'lovida valyuta tanlovi
--   So'mdagi qarzni dollarda (yoki aksincha) to'lash: to'lov o'z valyutasida
--   kassaga tushadi, qarz qoldig'i esa to'lovga muhrlangan Markaziy bank kursi
--   bilan hisoblanadi. Kurs 1 $ = 5 000–50 000 so'm (FO003).
--   Eski chaqiriqlar (valyutasiz) qarz valyutasida to'laydi.
-- =====================================================================

begin;

alter table public.debt_payments
  add column currency public.currency_code,
  add column rate_uzs_per_usd numeric(12, 2)
    check (rate_uzs_per_usd is null or rate_uzs_per_usd between 5000 and 50000);

update public.debt_payments p
set currency = d.currency
from public.debts d
where d.id = p.debt_id;

alter table public.debt_payments alter column currency set not null;


-- Qarzga to'langan jami — qarz valyutasida.
create or replace function public.debt_paid_total(p_debt_id uuid, p_currency public.currency_code)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(round(sum(public.to_order_currency(amount, currency, p_currency, coalesce(rate_uzs_per_usd, 1))), 2), 0)
  from public.debt_payments
  where debt_id = p_debt_id
$$;

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
    -- To'lovlar qarz valyutasiga muhrlangan kurs bilan o'giriladi (eski valyuta bo'yicha;
    -- to'lovi bor qarz valyutasi baribir o'zgarmaydi — FD003).
    v_paid := public.debt_paid_total(new.id, old.currency);
    select max(paid_at) into v_last_paid from public.debt_payments where debt_id = new.id;
    if (new.currency <> old.currency or new.direction <> old.direction)
       and exists (select 1 from public.debt_payments where debt_id = new.id) then
      raise exception 'debt with payments cannot change currency or direction' using errcode = 'FD003';
    end if;
    -- Faqat summani kamaytirishda: boshqa valyutadagi to'lov bir tiyindan kam ortib ketgan bo'lishi mumkin.
    if new.amount < old.amount and new.amount < v_paid then
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

drop function public.add_debt_payment(uuid, numeric, public.payment_method, timestamptz);

create or replace function public.add_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_paid_at timestamptz default now(),
  p_currency public.currency_code default null,
  p_rate numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debt public.debts;
  v_amount numeric := round(p_amount, 2);
  v_currency public.currency_code;
  v_rate numeric := round(p_rate, 2);
  v_paid numeric;
  v_type public.transaction_type;
  v_category text;
  v_transaction_id uuid;
  v_payment_id uuid;
begin
  select * into v_debt from public.debts where id = p_debt_id for update;
  if not found or not public.is_business_owner(v_debt.business_id) then
    raise exception 'only the owner can do this' using errcode = 'FB003';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'payment must be positive' using errcode = '23514';
  end if;

  v_currency := coalesce(p_currency, v_debt.currency);
  if v_currency = v_debt.currency then
    v_rate := null;
  elsif v_rate is null or v_rate < 5000 or v_rate > 50000 then
    raise exception 'exchange rate is not realistic' using errcode = 'FO003';
  end if;

  if round(public.to_order_currency(v_amount, v_currency, v_debt.currency, coalesce(v_rate, 1)), 2) <= 0 then
    raise exception 'payment is worth nothing in the debt currency' using errcode = '23514';
  end if;

  v_paid := public.debt_paid_total(p_debt_id, v_debt.currency);
  -- Boshqa valyutada to'lovni sentgacha aniq qilib bo'lmaydi: ortiqcha qism to'lov valyutasining
  -- bir sentidan kam bo'lsa, to'lov qabul qilinadi va qarz yopiladi.
  if v_currency = v_debt.currency then
    if round(v_paid + v_amount, 2) > v_debt.amount then
      raise exception 'payment exceeds the remaining debt' using errcode = 'FD001';
    end if;
  elsif v_paid + public.to_order_currency(v_amount - 0.01, v_currency, v_debt.currency, v_rate) > v_debt.amount then
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
    (auth.uid(), v_debt.business_id, public.debt_category_id(v_debt.business_id, v_type, v_category, auth.uid()),
     v_type, v_amount, v_currency, p_payment_method,
     left(v_debt.counterparty || coalesce(' — ' || v_debt.note, ''), 500),
     p_paid_at, 'debt_payment', v_debt.id)
  returning id into v_transaction_id;

  insert into public.debt_payments
    (business_id, debt_id, user_id, amount, currency, rate_uzs_per_usd, payment_method, paid_at, transaction_id)
  values
    (v_debt.business_id, v_debt.id, auth.uid(), v_amount, v_currency, v_rate, p_payment_method, p_paid_at, v_transaction_id)
  returning id into v_payment_id;

  -- Trigger paid_at ni qayta hisoblaydi.
  update public.debts set updated_at = now() where id = p_debt_id;
  return v_payment_id;
end;
$$;

-- Eski ilova: "To'landi" — qoldiqni qarz valyutasida to'lash.
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
  -- RLS ostida (faqat egasi o'qiydi): to'lovlar qarz valyutasiga o'giriladi.
  select d.amount - coalesce((
    select round(sum(public.to_order_currency(p.amount, p.currency, d.currency, coalesce(p.rate_uzs_per_usd, 1))), 2)
    from public.debt_payments p
    where p.debt_id = d.id
  ), 0)
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

revoke all on function public.debt_paid_total(uuid, public.currency_code) from public, anon, authenticated;
revoke all on function public.add_debt_payment(uuid, numeric, public.payment_method, timestamptz, public.currency_code, numeric) from public, anon;
grant execute on function public.add_debt_payment(uuid, numeric, public.payment_method, timestamptz, public.currency_code, numeric) to authenticated;

commit;
