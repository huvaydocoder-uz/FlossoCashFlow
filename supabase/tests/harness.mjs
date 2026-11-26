// Supabase o'rnini bosuvchi lokal Postgres (PGlite) — migratsiyalar va RLS'ni sinash uchun.
// auth sxemasi, auth.users, auth.uid() va anon/authenticated rollari soddalashtirib yaratiladi.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public to anon, authenticated;
`;

export function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

// `upTo` — shu fayl nomigacha (o'zi ham) migratsiyalarni qo'llaydi; berilmasa — hammasini.
export async function createDb({ upTo } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const name of migrationFiles()) {
    await db.exec(readFileSync(path.join(migrationsDir, name), 'utf8'));
    if (name === upTo) {
      break;
    }
  }
  return db;
}

export async function applyMigration(db, name) {
  await db.exec(readFileSync(path.join(migrationsDir, name), 'utf8'));
}

// Ro'yxatdan o'tish: auth.users ga yozuv (trigger public.users ni to'ldiradi).
export async function signUp(db, id, fullName = 'Test') {
  await db.query('insert into auth.users (id, raw_user_meta_data) values ($1, $2)', [
    id,
    { full_name: fullName },
  ]);
  return id;
}

// So'rovni tizimga kirgan foydalanuvchi nomidan (RLS bilan) bajaradi.
export async function as(db, userId, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await tx.exec('set local role authenticated');
    return tx.query(sql, params);
  });
}

export const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
