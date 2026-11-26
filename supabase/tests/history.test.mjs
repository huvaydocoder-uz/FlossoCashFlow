import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';

import { as, createDb, signUp, uuid } from './harness.mjs';

const OWNER = uuid(81);
const SELLER = uuid(82);
const NOV = '2026-11-01';
const DEC = '2026-12-01';
let db;

const owner = (sql, params) => as(db, OWNER, sql, params);
const count = async (sql, params) => (await db.query(sql, params)).rows[0].n;

before(async () => {
  db = await createDb();
  await signUp(db, OWNER, 'Farid');
  const { rows } = await owner("select join_code from public.create_business('Flosso')");
  await signUp(db, SELLER, 'Aziz');
  await as(db, SELLER, 'select public.join_business($1)', [rows[0].join_code]);
  await owner('select public.approve_member($1)', [SELLER]);
});

test('deleting an account keeps history', async () => {
  const { rows } = await as(db, SELLER, "insert into public.orders (customer_name, agreed_price, currency) values ('Mijoz', 500, 'USD') returning id");
  const orderId = rows[0].id;
  await as(db, SELLER, "select public.add_order_payment($1, 200, 'USD', 'cash', 12000)", [orderId]);
  await owner("insert into public.transactions (type, amount, currency) values ('income', 10, 'UZS')");
  const txBefore = await count('select count(*)::int as n from public.transactions');
  const catsBefore = await count('select count(*)::int as n from public.categories');
  await db.query('delete from auth.users where id = $1', [SELLER]);
  assert.equal(await count('select count(*)::int as n from public.transactions'), txBefore, 'kassa amallari qoldi');
  assert.equal(await count('select count(*)::int as n from public.categories'), catsBefore, 'kategoriyalar qoldi');
  assert.equal(await count('select count(*)::int as n from public.order_payments where order_id = $1', [orderId]), 1);
  const { rows: listed } = await owner('select seller_name, paid from public.order_list where id = $1', [orderId]);
  assert.equal(listed[0].seller_name, 'Aziz', 'sotuvchi ismi saqlandi');
  assert.equal(Number(listed[0].paid), 200);
});

test('deleting a paid employee archives it and keeps its months', async () => {
  const { rows } = await owner(
    "insert into public.employees (full_name, pay_type, fixed_salary, salary_currency) values ('Eski usta', 'fixed', 3000000, 'UZS') returning id",
  );
  const emp = rows[0].id;
  await owner("select public.add_salary_payment($1, $2, 1000000, 'UZS', 'cash', null, 'advance')", [emp, NOV]);
  await owner('delete from public.employees where id = $1', [emp]);
  const { rows: kept } = await owner('select active, deleted_at is not null as deleted from public.employees where id = $1', [emp]);
  assert.deepEqual(kept, [{ active: false, deleted: true }]);
  assert.equal(await count("select count(*)::int as n from public.transactions where source = 'salary_payment'"), 1);
  const { rows: nov } = await owner('select employee_id from public.payroll($1) where employee_id = $2', [NOV, emp]);
  assert.equal(nov.length, 1, "o'tgan oyda ko'rinadi");
  const { rows: dec } = await owner('select employee_id from public.payroll($1) where employee_id = $2', [DEC, emp]);
  assert.equal(dec.length, 0, "keyingi oylarda yo'q");
});

test('deleting an unpaid employee removes it', async () => {
  const { rows } = await owner("insert into public.employees (full_name, pay_type) values ('Sinov', 'fixed') returning id");
  await owner('delete from public.employees where id = $1', [rows[0].id]);
  assert.equal(await count('select count(*)::int as n from public.employees where id = $1', [rows[0].id]), 0);
});

test('history migration runs in an explicit transaction', () => {
  const sql = readFileSync(new URL('../migrations/20261109180000_keep_history.sql', import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '')
    .trim();
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;$/i);
});

async function team(prefix) {
  const ownerId = uuid(prefix);
  const sellerId = uuid(prefix + 1);
  await signUp(db, ownerId, 'Ega');
  const { rows } = await as(db, ownerId, "select join_code from public.create_business('Biznes')");
  await signUp(db, sellerId, 'Sotuvchi');
  await as(db, sellerId, 'select public.join_business($1)', [rows[0].join_code]);
  await as(db, ownerId, 'select public.approve_member($1)', [sellerId]);
  return { ownerId, sellerId };
}

test('deleting the owner account cascades cleanly', async () => {
  const { ownerId } = await team(90);
  const { rows } = await as(db, ownerId, "insert into public.employees (full_name, pay_type, fixed_salary) values ('U', 'fixed', 100) returning id, business_id");
  await as(db, ownerId, "select public.add_salary_payment($1, $2, 10, 'UZS', 'cash', null, 'salary')", [rows[0].id, NOV]);
  await db.query('delete from auth.users where id = $1', [ownerId]);
  assert.equal(await count('select count(*)::int as n from public.employees where business_id = $1', [rows[0].business_id]), 0);
});

test('archived employee frees the account for a new card', async () => {
  const { ownerId, sellerId } = await team(100);
  const { rows } = await as(db, ownerId, "insert into public.employees (full_name, pay_type, member_user_id) values ('S', 'commission', $1) returning id", [sellerId]);
  await as(db, ownerId, "select public.add_salary_payment($1, $2, 5, 'USD', 'cash', null, 'salary')", [rows[0].id, NOV]);
  await as(db, ownerId, 'delete from public.employees where id = $1', [rows[0].id]);
  await as(db, ownerId, "insert into public.employees (full_name, pay_type, member_user_id) values ('S yangi', 'commission', $1)", [sellerId]);
});

test('departed seller keeps commission history and name', async () => {
  const { ownerId, sellerId } = await team(110);
  const { rows: emp } = await as(db, ownerId, "insert into public.employees (full_name, pay_type, member_user_id) values ('Ketgan', 'commission', $1) returning id", [sellerId]);
  await as(db, ownerId, 'insert into public.commission_tiers (employee_id, from_usd, percent) values ($1, 0, 10)', [emp[0].id]);
  const { rows: ord } = await as(db, sellerId, "insert into public.orders (customer_name, agreed_price, currency, order_date) values ('M', 500, 'USD', $1) returning id", ['2026-11-10']);
  await as(db, sellerId, "select public.add_order_payment($1, 200, 'USD', 'cash', 12000)", [ord[0].id]);
  await as(db, ownerId, "select public.add_salary_payment($1, $2, 20, 'USD', 'cash', null, 'salary')", [emp[0].id, NOV]);
  await db.query('delete from auth.users where id = $1', [sellerId]);
  const { rows } = await as(db, ownerId, 'select sales_usd, computed, overpaid from public.payroll($1) where employee_id = $2', [NOV, emp[0].id]);
  assert.deepEqual(rows.map((r) => [Number(r.sales_usd), Number(r.computed), Number(r.overpaid)]), [[200, 20, 0]]);
  const { rows: order } = await db.query('select seller_id, seller_name from public.orders where id = $1', [ord[0].id]);
  assert.deepEqual(order, [{ seller_id: null, seller_name: 'Sotuvchi' }]);
});

test('deleted employee stays visible up to the month of deletion', async () => {
  const { ownerId } = await team(120);
  const { rows } = await as(db, ownerId, "insert into public.employees (full_name, pay_type, fixed_salary) values ('Oy', 'fixed', 2500000) returning id", []);
  const emp = rows[0].id;
  const thisMonth = new Date();
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const prev = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
  const next = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 1);
  await as(db, ownerId, "select public.add_salary_payment($1, $2, 1000, 'UZS', 'cash', null, 'advance')", [emp, key(prev)]);
  await as(db, ownerId, 'insert into public.payroll_days (employee_id, month, days_worked) values ($1, $2, 10)', [emp, key(thisMonth)]);
  await as(db, ownerId, 'delete from public.employees where id = $1', [emp]);
  const seen = async (month) => (await as(db, ownerId, 'select 1 from public.payroll($1) where employee_id = $2', [month, emp])).rows.length;
  assert.equal(await seen(key(thisMonth)), 1, "o'chirilgan oyda qarz ko'rinadi");
  assert.equal(await seen(key(next)), 0);
});

test('removing the last payment of a deleted employee removes it', async () => {
  const { ownerId } = await team(130);
  const { rows } = await as(db, ownerId, "insert into public.employees (full_name, pay_type) values ('Arvoh', 'fixed') returning id");
  const { rows: pay } = await as(db, ownerId, "select public.add_salary_payment($1, $2, 10, 'UZS', 'cash', null, 'salary') as id", [rows[0].id, NOV]);
  await as(db, ownerId, 'delete from public.employees where id = $1', [rows[0].id]);
  await as(db, ownerId, 'select public.delete_salary_payment($1)', [pay[0].id]);
  assert.equal(await count('select count(*)::int as n from public.employees where id = $1', [rows[0].id]), 0);
});
