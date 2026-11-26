import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';

import { as, createDb, signUp, uuid } from './harness.mjs';

const OWNER = uuid(61);
const SELLER_A = uuid(62);
const SELLER_B = uuid(63);
const NOV = '2026-11-01';
const DEC = '2026-12-01';
const OCT = '2026-10-01';

let db;
let empA;
let empB;
let empFixed;

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `kutilgan xato ${code}, keldi ${error.code}: ${error.message}`);
    return true;
  });
}

const owner = (sql, params) => as(db, OWNER, sql, params);

async function employee(fields) {
  const cols = Object.keys(fields);
  const { rows } = await owner(
    `insert into public.employees (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    Object.values(fields),
  );
  return rows[0].id;
}

async function sale(seller, orderDate, paidUsd, { cancel = false } = {}) {
  const { rows } = await as(
    db,
    seller,
    "insert into public.orders (customer_name, agreed_price, currency, order_date) values ('Mijoz', 1000000, 'USD', $1) returning id",
    [orderDate],
  );
  await as(db, seller, "select public.add_order_payment($1, $2, 'USD', 'cash', 12000)", [rows[0].id, paidUsd]);
  if (cancel) {
    await owner("update public.orders set status = 'cancelled' where id = $1", [rows[0].id]);
  }
  return rows[0].id;
}

async function row(userId, month, employeeId) {
  const { rows } = await as(db, userId, 'select * from public.payroll($1) where employee_id = $2', [month, employeeId]);
  return rows[0];
}

const num = (value) => (value === null ? null : Number(value));

before(async () => {
  db = await createDb();
  await signUp(db, OWNER, 'Farid');
  const { rows } = await owner("select join_code from public.create_business('Flosso')");
  for (const [id, name] of [
    [SELLER_A, 'Aziz'],
    [SELLER_B, 'Bobur'],
  ]) {
    await signUp(db, id, name);
    await as(db, id, 'select public.join_business($1)', [rows[0].join_code]);
    await owner('select public.approve_member($1)', [id]);
  }
  empA = await employee({ full_name: 'Aziz', position: 'Sotuvchi', pay_type: 'commission', member_user_id: SELLER_A });
  empB = await employee({ full_name: 'Bobur', position: 'Sotuvchi', pay_type: 'commission', member_user_id: SELLER_B });
  empFixed = await employee({ full_name: 'Usta', phone: '+998901234567', position: 'Usta', pay_type: 'fixed', fixed_salary: 7000000, salary_currency: 'UZS' });
  for (const emp of [empA, empB]) {
    await owner(
      'insert into public.commission_tiers (employee_id, from_usd, percent) values ($1, 0, 2), ($1, 20000, 3), ($1, 35000, 4)',
      [emp],
    );
  }
});

test('fixed salary prorated, foreign payment converted', async () => {
  await owner('insert into public.payroll_days (employee_id, month, days_worked) values ($1, $2, 20)', [empFixed, NOV]);
  let r = await row(OWNER, NOV, empFixed);
  assert.equal(num(r.computed), 5600000);
  assert.equal(r.computed_currency, 'UZS');
  await owner("select public.add_salary_payment($1, $2, 100, 'USD', 'cash', 12000, 'advance')", [empFixed, NOV]);
  r = await row(OWNER, NOV, empFixed);
  assert.equal(num(r.paid), 1200000);
  assert.equal(num(r.remaining), 4400000);
  const { rows } = await owner(
    `select t.type, t.amount::float, t.currency, t.source, c.name from public.transactions t
     join public.categories c on c.id = t.category_id where t.source = 'salary_payment'`,
  );
  assert.deepEqual(rows, [{ type: 'expense', amount: 100, currency: 'USD', source: 'salary_payment', name: 'Oylik' }]);
});

test('commission tiers by whole volume', async () => {
  await sale(SELLER_A, '2026-11-05', 19999.99);
  let r = await row(OWNER, NOV, empA);
  assert.equal(num(r.sales_usd), 19999.99);
  assert.equal(num(r.percent), 2);
  assert.equal(num(r.computed), 400);
  assert.equal(r.computed_currency, 'USD');
  assert.equal(num(r.next_tier_from), 20000);
  await sale(SELLER_A, '2026-11-06', 0.01);
  r = await row(OWNER, NOV, empA);
  assert.equal(num(r.percent), 3);
  assert.equal(num(r.computed), 600);
  assert.equal(num(r.next_tier_from), 35000);
  await sale(SELLER_A, '2026-12-03', 60000);
  r = await row(OWNER, DEC, empA);
  assert.equal(num(r.percent), 4);
  assert.equal(num(r.computed), 2400);
  assert.equal(r.next_tier_from, null);
});

test('sales counted by order month, without cancelled or others', async () => {
  await sale(SELLER_A, '2026-10-20', 1000);
  await sale(SELLER_A, '2026-10-21', 5000, { cancel: true });
  await sale(SELLER_B, '2026-10-22', 7000);
  const r = await row(OWNER, OCT, empA);
  assert.equal(num(r.sales_usd), 1000);
  assert.equal(num(r.computed), 20);
});

test('seller sees only own payroll', async () => {
  const { rows } = await as(db, SELLER_A, 'select employee_id from public.payroll($1)', [NOV]);
  assert.deepEqual(rows.map((r) => r.employee_id), [empA]);
  const { rows: emps } = await as(db, SELLER_A, 'select id from public.employees');
  assert.deepEqual(emps.map((r) => r.id), [empA]);
  const { rows: pays } = await as(db, SELLER_B, 'select count(*)::int as n from public.salary_payments');
  assert.equal(pays[0].n, 0);
  await rejects(as(db, SELLER_A, "update public.employees set fixed_salary = 999 where id = $1 returning id", [empA]).then(({ rows: r }) => {
    if (r.length === 0) {
      const error = new Error('blocked');
      error.code = 'BLOCKED';
      throw error;
    }
  }), 'BLOCKED');
});

test('salary payment lifecycle', async () => {
  await rejects(as(db, SELLER_A, "select public.add_salary_payment($1, $2, 10, 'USD', 'cash', null, 'salary')", [empA, NOV]), 'FB003');
  const { rows } = await owner("select public.add_salary_payment($1, $2, 50, 'USD', 'card', null, 'salary') as id", [empA, NOV]);
  assert.equal(num((await row(SELLER_A, NOV, empA)).paid), 50);
  await rejects(owner("select public.add_salary_payment($1, $2, 1000, 'UZS', 'cash', 1, 'salary')", [empA, NOV]), 'FO003');
  // Oylik berilgan xodim o'chirilmaydi — arxivlanadi (tarix saqlanadi).
  await owner('delete from public.employees where id = $1', [empA]);
  const { rows: archived } = await owner('select active, deleted_at is not null as deleted from public.employees where id = $1', [empA]);
  assert.deepEqual(archived, [{ active: false, deleted: true }]);
  await owner('select public.delete_salary_payment($1)', [rows[0].id]);
  const { rows: tx } = await owner("select count(*)::int as n from public.transactions where source = 'salary_payment' and currency = 'USD' and payment_method = 'card'");
  assert.equal(tx[0].n, 0);
});

test('payroll migration runs in an explicit transaction', () => {
  const sql = readFileSync(new URL('../migrations/20261109120000_payroll.sql', import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '')
    .trim();
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;$/i);
});

test('save_employee writes employee and tiers atomically', async () => {
  const { rows } = await owner(
    "select public.save_employee(null, $1::jsonb, $2::jsonb) as id",
    [JSON.stringify({ full_name: 'Yangi', pay_type: 'commission' }), JSON.stringify([{ from_usd: 0, percent: 5 }, { from_usd: 10000, percent: 7 }])],
  );
  const id = rows[0].id;
  const { rows: tiers } = await owner('select from_usd::float, percent::float from public.commission_tiers where employee_id = $1 order by from_usd', [id]);
  assert.deepEqual(tiers, [{ from_usd: 0, percent: 5 }, { from_usd: 10000, percent: 7 }]);
  await rejects(
    owner("select public.save_employee($1, $2::jsonb, $3::jsonb)", [id, JSON.stringify({ full_name: 'Yangi', pay_type: 'commission' }), JSON.stringify([{ from_usd: 0, percent: 500 }])]),
    '23514',
  );
  const { rows: kept } = await owner('select count(*)::int as n from public.commission_tiers where employee_id = $1', [id]);
  assert.equal(kept[0].n, 2, "xato bo'lsa eski plan saqlanib qoladi");
  await rejects(as(db, SELLER_A, "select public.save_employee(null, '{\"full_name\":\"X\",\"pay_type\":\"fixed\"}'::jsonb, '[]'::jsonb)"), 'FB003');
});

test('paid month keeps its settings after salary change', async () => {
  const emp = await employee({ full_name: 'Muhrlangan', pay_type: 'fixed', fixed_salary: 5000000, salary_currency: 'UZS' });
  await owner('insert into public.payroll_days (employee_id, month, days_worked) values ($1, $2, 25)', [emp, NOV]);
  await owner("select public.add_salary_payment($1, $2, 1000000, 'UZS', 'cash', null, 'advance')", [emp, NOV]);
  await owner('update public.employees set fixed_salary = 9000000 where id = $1', [emp]);
  assert.equal(num((await row(OWNER, NOV, emp)).computed), 5000000);
  await owner('insert into public.payroll_days (employee_id, month, days_worked) values ($1, $2, 25)', [emp, DEC]);
  assert.equal(num((await row(OWNER, DEC, emp)).computed), 9000000);
});

test('foreign salary payment within one cent closes the month', async () => {
  const emp = await employee({ full_name: 'Sent', pay_type: 'fixed', fixed_salary: 5600000, salary_currency: 'UZS' });
  await owner('insert into public.payroll_days (employee_id, month, days_worked) values ($1, $2, 25)', [emp, NOV]);
  await owner("select public.add_salary_payment($1, $2, 442.69, 'USD', 'cash', 12650, 'salary')", [emp, NOV]);
  const r = await row(OWNER, NOV, emp);
  assert.equal(num(r.remaining), 0);
  assert.equal(num(r.overpaid), 0);
});
