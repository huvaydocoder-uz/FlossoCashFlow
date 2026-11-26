-- =====================================================================
-- Flosso — ombor katalogi
--   1-qism (mahsulotlar): flosso.uz katalogidagi 56 ta mahsulot — karniz, nalichnik,
--     kolonna va nalichnik igrushkalari, podokonnik, taroq-kolonna, termopanel —
--     kodi (FKR01-718 ...), narxi (so'm) va o'lchovi (metr / dona) bilan.
--   2-qism (xomashyo): penadekor ishlab chiqarish uchun doimiy materiallar —
--     qum (kg), penoplast blok (dona), zagustitel K-29 (kg), teksanol (kg), dots (kg).
--   Katalog har bir biznesga bir marta yoziladi: biznes yaratilganda (trigger) va
--   mavjud bizneslar uchun shu migratsiyada. Egasi keyin o'zgartirsa/o'chirsa,
--   qayta yozilmaydi (stock_catalog_seeds).
-- =====================================================================

begin;


-- 1. Kod va narx -------------------------------------------------------------------

alter table public.stock_items
  add column code  text check (code is null or (code = upper(btrim(code)) and char_length(code) between 1 and 30)),
  add column price numeric(14, 2) check (price is null or price >= 0);

create unique index stock_items_business_code_key on public.stock_items (business_id, code) where code is not null;

-- Doimiy materiallar ro'yxati: Flosso xomashyosi (+ eski shablon kalitlari, buyurtma
-- triggerlari ularga hali murojaat qilishi mumkin).
alter table public.stock_items drop constraint stock_items_system_key_check;
alter table public.stock_items add constraint stock_items_system_key_check check (
  system_key is null or system_key in (
    'sand', 'penoplast_block', 'thickener_k29', 'texanol', 'dots',
    'penoplast', 'chemicals'
  )
);


-- 2. Trigger: kod tozalanadi (bo'sh joy, kichik harf) -------------------------------

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
      -- Doimiy material nomi va o'lchovi o'zgarmaydi.
      if old.system_key is not null then
        new.name := old.name;
        new.unit := old.unit;
      end if;
    end if;
  elsif v_client then
    -- Doimiy materiallarni faqat material_item_id yaratadi.
    new.system_key := null;
  end if;
  if new.kind = 'material' then
    new.product_type := null;
  end if;
  new.code := nullif(upper(btrim(new.code)), '');
  return new;
end;
$$;


-- 3. Doimiy materiallar (xomashyo) -----------------------------------------------------

create or replace function public.material_item_id(p_business_id uuid, p_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := case p_key
    when 'sand' then 'Qum'
    when 'penoplast_block' then 'Penoplast blok'
    when 'thickener_k29' then 'Zagustitel K-29'
    when 'texanol' then 'Teksanol'
    when 'dots' then 'Dots'
    when 'penoplast' then 'Penoplast'
    else 'Ximikat'
  end;
  v_unit public.stock_unit := case when p_key in ('penoplast_block', 'penoplast') then 'dona'::public.stock_unit else 'kg'::public.stock_unit end;
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
    values (p_business_id, 'material', v_name, v_unit, p_key)
    on conflict do nothing;
    select id into v_id from public.stock_items where business_id = p_business_id and system_key = p_key;
  end if;
  return v_id;
end;
$$;


-- 4. Flosso katalogi ------------------------------------------------------------------

-- Qaysi biznesga katalog yozilgan (qayta yozmaslik uchun). Faqat ichki funksiyalar uchun.
create table public.stock_catalog_seeds (
  business_id  uuid primary key references public.businesses (id) on delete cascade,
  seeded_at    timestamptz not null default now()
);
alter table public.stock_catalog_seeds enable row level security;
revoke all on public.stock_catalog_seeds from anon, authenticated;

create or replace function public.seed_flosso_stock(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 2-qism: xomashyo (har doim bor bo'lsin).
  perform public.material_item_id(p_business_id, k)
  from unnest(array['sand', 'penoplast_block', 'thickener_k29', 'texanol', 'dots']) as k;

  -- 1-qism: mahsulotlar — bir marta.
  insert into public.stock_catalog_seeds (business_id) values (p_business_id)
  on conflict do nothing;
  if not found then
    return;
  end if;

  insert into public.stock_items (business_id, kind, product_type, code, name, unit, price)
  select p_business_id, 'product', c.product_type::public.product_type, c.code, c.name, c.unit::public.stock_unit, c.price
  from (values
    (1, 'kolonna_igrushka', 'FIK(P)01-818', 'Kolonna pasti, 1-model, 8×18 sm', 'dona', 47000),
    (2, 'kolonna_igrushka', 'FIK(P)02-818', 'Kolonna pasti, 2-model, 8×18 sm', 'dona', 47000),
    (3, 'kolonna_igrushka', 'FIK(P)03-612', 'Kolonna pasti, 3-model, 6×12 sm', 'dona', 39000),
    (4, 'kolonna_igrushka', 'FIK(T)04-717', 'Kolonna tepasi, 4-model, 7×17 sm', 'dona', 44000),
    (5, 'kolonna_igrushka', 'FIK(T)05-716', 'Kolonna tepasi, 5-model, 7×16 sm', 'dona', 43000),
    (6, 'kolonna_igrushka', 'FIK(T)06-818', 'Kolonna tepasi, 6-model, 8×18 sm', 'dona', 47000),
    (7, 'kolonna_igrushka', 'FIK(T)07-818', 'Kolonna tepasi, 7-model, 8×18 sm', 'dona', 47000),
    (8, 'nalichnik_igrushka', 'FIN01-612', 'Nalichnik igrushkasi, 1-model, 6×12 sm', 'dona', 23400),
    (9, 'nalichnik_igrushka', 'FIN02-614', 'Nalichnik igrushkasi, 2-model, 6×14 sm', 'dona', 28000),
    (10, 'nalichnik_igrushka', 'FIN03-514', 'Nalichnik igrushkasi, 3-model, 5×14 sm', 'dona', 26000),
    (11, 'nalichnik_igrushka', 'FIN04-613', 'Nalichnik igrushkasi, 4-model, 6×13 sm', 'dona', 27000),
    (12, 'nalichnik_igrushka', 'FIN05-612', 'Nalichnik igrushkasi, 5-model, 6×12 sm', 'dona', 23400),
    (13, 'nalichnik_igrushka', 'FIN06-514', 'Nalichnik igrushkasi, 6-model, 5×14 sm', 'dona', 26000),
    (14, 'karniz', 'FKR01-718', 'Karniz, 1-model, 7×18 sm', 'metr', 52700),
    (15, 'karniz', 'FKR01-615', 'Karniz, 1-model, 6×15 sm', 'metr', 46500),
    (16, 'karniz', 'FKR01-512', 'Karniz, 1-model, 5×12 sm', 'metr', 28900),
    (17, 'karniz', 'FKR02-718', 'Karniz, 2-model, 7×18 sm', 'metr', 62000),
    (18, 'karniz', 'FKR02-615', 'Karniz, 2-model, 6×15 sm', 'metr', 46500),
    (19, 'karniz', 'FKR02-512', 'Karniz, 2-model, 5×12 sm', 'metr', 34000),
    (20, 'karniz', 'FKR03-715', 'Karniz, 3-model, 7×15 sm', 'metr', 43500),
    (21, 'karniz', 'FKR03-818', 'Karniz, 3-model, 8×18 sm', 'metr', 70000),
    (22, 'karniz', 'FKR04-817', 'Karniz, 4-model, 8×17 sm', 'metr', 66500),
    (23, 'nalichnik', 'FNL01-310', 'Nalichnik, 1-model, 3×10 sm', 'metr', 18900),
    (24, 'nalichnik', 'FNL01-312', 'Nalichnik, 1-model, 3×12 sm', 'metr', 23500),
    (25, 'nalichnik', 'FNL01-415', 'Nalichnik, 1-model, 4×15 sm', 'metr', 34000),
    (26, 'nalichnik', 'FNL02-310', 'Nalichnik, 2-model, 3×10 sm', 'metr', 16800),
    (27, 'nalichnik', 'FNL02-312', 'Nalichnik, 2-model, 3×12 sm', 'metr', 23500),
    (28, 'nalichnik', 'FNL02-415', 'Nalichnik, 2-model, 4×15 sm', 'metr', 34000),
    (29, 'nalichnik', 'FNL03-310', 'Nalichnik, 3-model, 3×10 sm', 'metr', 21000),
    (30, 'nalichnik', 'FNL03-312', 'Nalichnik, 3-model, 3×12 sm', 'metr', 23500),
    (31, 'nalichnik', 'FNL03-315', 'Nalichnik, 3-model, 3×15 sm', 'metr', 27500),
    (32, 'nalichnik', 'FNL04-310', 'Nalichnik, 4-model, 3×10 sm', 'metr', 21000),
    (33, 'nalichnik', 'FNL04-312', 'Nalichnik, 4-model, 3×12 sm', 'metr', 23500),
    (34, 'nalichnik', 'FNL04-315', 'Nalichnik, 4-model, 3×15 sm', 'metr', 27500),
    (35, 'podokonnik', 'FPD01-513', 'Podokonnik, 1-model, 5×13 sm', 'metr', 36000),
    (36, 'podokonnik', 'FPD01-615', 'Podokonnik, 1-model, 6×15 sm', 'metr', 40900),
    (37, 'podokonnik', 'FPD02-513', 'Podokonnik, 2-model, 5×13 sm', 'metr', 36000),
    (38, 'podokonnik', 'FPD02-615', 'Podokonnik, 2-model, 6×15 sm', 'metr', 46500),
    (39, 'podokonnik', 'FPD03-513', 'Podokonnik, 3-model, 5×13 sm', 'metr', 36000),
    (40, 'podokonnik', 'FPD03-615', 'Podokonnik, 3-model, 6×15 sm', 'metr', 46500),
    (41, 'podokonnik', 'FPD04-513', 'Podokonnik, 4-model, 5×13 sm', 'metr', 36000),
    (42, 'podokonnik', 'FPD04-615', 'Podokonnik, 4-model, 6×15 sm', 'metr', 46500),
    (43, 'podokonnik', 'FPD05-413', 'Podokonnik, 5-model, 4×13 sm', 'metr', 30500),
    (44, 'podokonnik', 'FPD05-515', 'Podokonnik, 5-model, 5×15 sm', 'metr', 40500),
    (45, 'podokonnik', 'FPD06-413', 'Podokonnik, 6-model, 4×13 sm', 'metr', 30500),
    (46, 'taroq_kolonna', 'FTK01-325', 'Taroq-kolonna, 1-model, 3×25 sm', 'metr', 50500),
    (47, 'taroq_kolonna', 'FTK01-420', 'Taroq-kolonna, 1-model, 4×20 sm', 'metr', 42400),
    (48, 'taroq_kolonna', 'FTK01-430', 'Taroq-kolonna, 1-model, 4×30 sm', 'metr', 74500),
    (49, 'taroq_kolonna', 'FTK01-440', 'Taroq-kolonna, 1-model, 4×40 sm', 'metr', 96000),
    (50, 'taroq_kolonna', 'FTK02-325', 'Taroq-kolonna, 2-model, 3×25 sm', 'metr', 50500),
    (51, 'taroq_kolonna', 'FTK02-330', 'Taroq-kolonna, 2-model, 3×30 sm', 'metr', 58500),
    (52, 'taroq_kolonna', 'FTK02-440', 'Taroq-kolonna, 2-model, 4×40 sm', 'metr', 96000),
    (53, 'termopanel', 'FTP01-330', 'Termopanel, 1-model, 3×30 sm', 'metr', 46800),
    (54, 'termopanel', 'FTP01-440', 'Termopanel, 1-model, 4×40 sm', 'metr', 96000),
    (55, 'termopanel', 'FTP02-330', 'Termopanel, 2-model, 3×30 sm', 'metr', 58500),
    (56, 'termopanel', 'FTP02-440', 'Termopanel, 2-model, 4×40 sm', 'metr', 96000)
  ) as c (position, product_type, code, name, unit, price)
  order by c.position
  on conflict do nothing;
end;
$$;

-- Yangi biznes — katalog darhol tayyor (sotuvchi ham buyurtmada tanlay oladi).
create or replace function public.businesses_seed_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_flosso_stock(new.id);
  return null;
end;
$$;

create trigger businesses_seed_stock
  after insert on public.businesses
  for each row execute function public.businesses_seed_stock();

-- Ombor ochilganda (egasi): xomashyo va katalog borligini tekshiradi.
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
  perform public.seed_flosso_stock(v_business_id);
end;
$$;

-- Mavjud bizneslar uchun darhol.
select public.seed_flosso_stock(b.id) from public.businesses b;

revoke all on function public.seed_flosso_stock(uuid) from public, anon, authenticated;
revoke all on function public.businesses_seed_stock() from public, anon, authenticated;
revoke all on function public.material_item_id(uuid, text) from public, anon, authenticated;
revoke all on function public.ensure_stock_defaults() from public, anon;
grant execute on function public.ensure_stock_defaults() to authenticated;

commit;