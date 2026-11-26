-- =====================================================================
-- Ilova — boshlang'ich baza sxemasi
-- Jadvallar: users, categories, transactions  +  balances (view)
-- Har bir jadvalda RLS yoqilgan: foydalanuvchi faqat o'z ma'lumotini ko'radi.
-- Talab: PostgreSQL 15+ (Supabase'dagi yangi loyihalar shunday).
-- =====================================================================


-- 1. Turlar (enum) -----------------------------------------------------

create type public.transaction_type as enum ('income', 'expense');
create type public.currency_code    as enum ('UZS', 'USD');


-- 2. updated_at ustunini avtomatik yangilovchi funksiya ----------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- 3. users — foydalanuvchi profili (auth.users bilan 1:1) ---------------
-- Email va parol Supabase Auth'da (auth.users) saqlanadi, bu yerda emas.

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Ro'yxatdan o'tganda public.users'ga avtomatik yozuv qo'shiladi.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 4. categories — kategoriyalar -----------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid()
              references public.users (id) on delete cascade,
  name        text not null
              check (name = btrim(name) and char_length(name) between 1 and 50),
  type        public.transaction_type not null,
  created_at  timestamptz not null default now(),
  -- transactions'dagi tarkibiy tashqi kalit uchun kerak (pastga qarang)
  constraint categories_id_user_type_key unique (id, user_id, type)
);

-- Bir foydalanuvchida bir turdagi bir xil nomli kategoriya takrorlanmaydi
-- (katta-kichik harf farqi hisobga olinmaydi).
create unique index categories_user_type_name_key
  on public.categories (user_id, type, lower(name));


-- 5. transactions — kirim va chiqim amallari ----------------------------

create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
               references public.users (id) on delete cascade,
  category_id  uuid,
  type         public.transaction_type not null,
  amount       numeric(18, 2) not null check (amount > 0),
  currency     public.currency_code not null,
  note         text check (note is null or char_length(note) <= 500),
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Kategoriya aynan shu foydalanuvchiniki va turi (kirim/chiqim) bir xil
  -- bo'lishi shart. Kategoriya o'chirilsa, tranzaksiya saqlanib qoladi,
  -- faqat category_id = NULL ("Kategoriyasiz") bo'ladi.
  constraint transactions_category_fkey
    foreign key (category_id, user_id, type)
    references public.categories (id, user_id, type)
    on delete set null (category_id)
);

create index transactions_user_occurred_idx
  on public.transactions (user_id, occurred_at desc);

create index transactions_category_idx
  on public.transactions (category_id);

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();


-- 6. balances — har bir valyuta bo'yicha balans (Dashboard uchun) --------
-- security_invoker: view so'rov yuborgan foydalanuvchi huquqi bilan ishlaydi,
-- ya'ni transactions'dagi RLS bu yerda ham amal qiladi.

create view public.balances
with (security_invoker = on) as
select
  user_id,
  currency,
  coalesce(sum(amount) filter (where type = 'income'), 0)  as total_income,
  coalesce(sum(amount) filter (where type = 'expense'), 0) as total_expense,
  sum(case when type = 'income' then amount else -amount end) as balance
from public.transactions
group by user_id, currency;


-- 7. Row Level Security -------------------------------------------------

alter table public.users        enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

-- users: faqat o'z profilini ko'radi va tahrirlaydi
create policy users_select_own on public.users
  for select to authenticated
  using ((select auth.uid()) = id);

create policy users_update_own on public.users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- categories: ko'rish, yaratish, o'chirish (tahrirlash tavsifda yo'q)
create policy categories_select_own on public.categories
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy categories_insert_own on public.categories
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy categories_delete_own on public.categories
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- transactions: ko'rish, qo'shish, tahrirlash, o'chirish — faqat o'ziniki
create policy transactions_select_own on public.transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy transactions_insert_own on public.transactions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy transactions_update_own on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy transactions_delete_own on public.transactions
  for delete to authenticated
  using ((select auth.uid()) = user_id);


-- 8. Ruxsatlar (grants) -------------------------------------------------
-- Tizimga kirmagan mehmon (anon) hech narsaga kira olmaydi.
-- Kirgan foydalanuvchiga faqat kerakli amallar beriladi.

revoke all on public.users, public.categories, public.transactions, public.balances
  from anon, authenticated;

grant select                         on public.users        to authenticated;
grant update (full_name)             on public.users        to authenticated;
grant select, insert, delete         on public.categories   to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select                         on public.balances     to authenticated;
