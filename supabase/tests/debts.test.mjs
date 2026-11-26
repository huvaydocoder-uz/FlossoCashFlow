import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';

import { as, createDb, signUp, uuid } from './harness.mjs';

const OWNER = uuid(11);
const SELLER = uuid(12);

let db;

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `kutilgan xato ${code}, keldi ${error.code}: ${error.message}`);
    return true;
  });
}

const owner = (sql, params) => as(db, OWNER, sql, params);

async function newDebt(fields) {
  const cols = Object.keys(fields);
  const { rows } = await owner(
    `insert into public.debts (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    Object.values(fields),
  );
  return rows[0];
}

async function debtTransactions(debtId) {
  const { rows } = await owner(
    `select t.type, t.amount::float as amount, t.payment_method, t.source, c.name as category
     from public.transactions t left join public.categories c on c.id = t.category_id
     where t.debt_id = $1 order by t.created_at, t.amount`,
    [debtId],
  );
  return rows;
}

async function pay(debtId, amount, method = 'cash') {
  const { rows } = await owner('select public.add_debt_payment($1, $2, $3) as id', [debtId, amount, method]);
  return rows[0].id;
}

async function debt(id) {
  const { rows } = await owner('select * from public.debts where id = $1', [id]);
  return rows[0];
}

before(async () => {
  db = await createDb();
  await signUp(db, OWNER, 'Egasi');
  const { rows } = await owner("select join_code from public.create_business('Flosso')");
  await signUp(db, SELLER, 'Sotuvchi');
  await as(db, SELLER, 'select public.join_business($1)', [rows[0].join_code]);
  await owner('select public.approve_member($1)', [SELLER]);
});

const base = { counterparty: 'Ali', currency: 'UZS', due_date: '2026-11-30' };

test('nasiya debt leaves cash untouched', async () => {
  const d = await newDebt({ ...base, direction: 'receivable', amount: 500 });
  assert.equal(d.origin_method, null);
  assert.deepEqual(await debtTransactions(d.id), []);
});

test('cash payable debt adds income', async () => {
  const d = await newDebt({ ...base, direction: 'payable', amount: 100, currency: 'USD', origin_method: 'cash', phone: '+998 90 123-45-67', sector: 'Qurilish' });
  assert.deepEqual(await debtTransactions(d.id), [
    { type: 'income', amount: 100, payment_method: 'cash', source: 'debt_origin', category: 'Olingan qarzlar' },
  ]);
  assert.notEqual((await debt(d.id)).origin_transaction_id, null);
});

test('origin transaction follows debt edits', async () => {
  const d = await newDebt({ ...base, direction: 'payable', amount: 100, origin_method: 'cash' });
  await owner('update public.debts set amount = 150 where id = $1', [d.id]);
  assert.equal((await debtTransactions(d.id))[0].amount, 150);
  await owner('update public.debts set origin_method = null where id = $1', [d.id]);
  assert.deepEqual(await debtTransactions(d.id), []);
  assert.equal((await debt(d.id)).origin_transaction_id, null);
  await owner("update public.debts set origin_method = 'card', direction = 'receivable' where id = $1", [d.id]);
  assert.deepEqual(await debtTransactions(d.id), [
    { type: 'expense', amount: 150, payment_method: 'card', source: 'debt_origin', category: 'Berilgan qarzlar' },
  ]);
});

test('overpay rejected, exact remainder closes debt', async () => {
  const d = await newDebt({ ...base, direction: 'receivable', amount: 84300000 });
  await pay(d.id, 30000000);
  assert.equal((await debt(d.id)).paid_at, null);
  await rejects(pay(d.id, 60000000), 'FD001');
  await pay(d.id, 54300000, 'card');
  assert.notEqual((await debt(d.id)).paid_at, null);
  assert.deepEqual(await debtTransactions(d.id), [
    { type: 'income', amount: 30000000, payment_method: 'cash', source: 'debt_payment', category: 'Kompaniyadan mijozlar qarzlari' },
    { type: 'income', amount: 54300000, payment_method: 'card', source: 'debt_payment', category: 'Kompaniyadan mijozlar qarzlari' },
  ]);
});

test('deleting payment removes its transaction and reopens debt', async () => {
  const d = await newDebt({ ...base, direction: 'payable', amount: 200 });
  await pay(d.id, 50);
  const last = await pay(d.id, 150);
  assert.notEqual((await debt(d.id)).paid_at, null);
  await owner('select public.delete_debt_payment($1)', [last]);
  assert.equal((await debt(d.id)).paid_at, null);
  assert.deepEqual(await debtTransactions(d.id), [
    { type: 'expense', amount: 50, payment_method: 'cash', source: 'debt_payment', category: "Kompaniya berishi kerak bo'lgan qarzlar" },
  ]);
});

test('debt edits cannot undercut payments', async () => {
  const d = await newDebt({ ...base, direction: 'receivable', amount: 300 });
  await pay(d.id, 200);
  await rejects(owner('update public.debts set amount = 100 where id = $1', [d.id]), 'FD002');
  await rejects(owner("update public.debts set currency = 'USD' where id = $1", [d.id]), 'FD003');
  await owner('update public.debts set amount = 200 where id = $1', [d.id]);
  assert.notEqual((await debt(d.id)).paid_at, null, "summa to'langanga teng bo'lsa — yopiladi");
});

test('deleting debt removes its transactions', async () => {
  const d = await newDebt({ ...base, direction: 'payable', amount: 90, origin_method: 'card' });
  await pay(d.id, 40);
  assert.equal((await debtTransactions(d.id)).length, 2);
  const { rows: before } = await owner('select count(*)::int as n from public.transactions');
  await owner('delete from public.debts where id = $1', [d.id]);
  const { rows: after } = await owner('select count(*)::int as n from public.transactions');
  assert.equal(after[0].n, before[0].n - 2);
});

test('old pay_debt pays remainder and unpay_debt removes payments', async () => {
  const d = await newDebt({ ...base, direction: 'payable', amount: 1000 });
  await pay(d.id, 400);
  await owner("select public.pay_debt($1, 'card')", [d.id]);
  const { rows } = await owner('select coalesce(sum(amount), 0)::float as paid from public.debt_payments where debt_id = $1', [d.id]);
  assert.equal(rows[0].paid, 1000);
  assert.notEqual((await debt(d.id)).paid_at, null);
  await owner('select public.unpay_debt($1)', [d.id]);
  assert.equal((await debt(d.id)).paid_at, null);
  assert.deepEqual(await debtTransactions(d.id), []);
});

test('auto transactions are locked', async () => {
  const d = await newDebt({ ...base, direction: 'receivable', amount: 70 });
  await pay(d.id, 70);
  await owner("update public.transactions set amount = 1 where debt_id = $1", [d.id]);
  await owner('delete from public.transactions where debt_id = $1', [d.id]);
  assert.equal((await debtTransactions(d.id))[0].amount, 70, "avtomatik amal o'zgarmadi");
  await rejects(
    owner("insert into public.transactions (type, amount, currency, source) values ('income', 1, 'UZS', 'debt_payment')"),
    '42501',
  );
  await owner("insert into public.transactions (type, amount, currency) values ('income', 1, 'UZS')");
});

test('seller cannot add payment or see payments', async () => {
  const d = await newDebt({ ...base, direction: 'receivable', amount: 10 });
  await rejects(as(db, SELLER, "select public.add_debt_payment($1, 5, 'cash')", [d.id]), 'FB003');
  const { rows } = await as(db, SELLER, 'select count(*)::int as n from public.debt_payments');
  assert.equal(rows[0].n, 0);
});

test('debt payments migration runs in an explicit transaction', () => {
  const sql = readFileSync(new URL('../migrations/20261108200000_debt_payments.sql', import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '')
    .trim();
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;$/i);
});

test('legacy paid debt becomes one payment', async () => {
  const { applyMigration } = await import('./harness.mjs');
  const old = await createDb({ upTo: '20261108150000_business_team.sql' });
  const user = uuid(21);
  await signUp(old, user, 'Eski');
  await as(old, user, "select public.create_business('Eski')");
  const { rows } = await as(
    old,
    user,
    "insert into public.debts (direction, counterparty, amount, currency, due_date) values ('receivable', 'Vali', 300, 'USD', current_date) returning id",
  );
  await as(old, user, "select public.pay_debt($1, 'card')", [rows[0].id]);
  await applyMigration(old, '20261108200000_debt_payments.sql');
  const { rows: payments } = await as(old, user, 'select amount::float, payment_method from public.debt_payments');
  assert.deepEqual(payments, [{ amount: 300, payment_method: 'card' }]);
  const { rows: debts } = await as(old, user, 'select paid_at is not null as paid, transaction_id from public.debts');
  assert.deepEqual(debts, [{ paid: true, transaction_id: null }]);
  const { rows: tx } = await as(old, user, "select source from public.transactions where debt_id is not null");
  assert.deepEqual(tx, [{ source: 'debt_payment' }]);
});

test('forged origin id cannot touch other transactions', async () => {
  const other = uuid(31);
  await signUp(db, other, 'Boshqa');
  await as(db, other, "select public.create_business('Boshqa biznes')");
  const { rows: victim } = await as(
    db,
    other,
    "insert into public.transactions (type, amount, currency) values ('income', 777, 'UZS') returning id",
  );
  const d = await newDebt({ ...base, direction: 'receivable', amount: 5, origin_transaction_id: victim[0].id });
  const { rows: still } = await db.query('select count(*)::int as n from public.transactions where id = $1', [victim[0].id]);
  assert.equal(still[0].n, 1, "boshqa biznes amali o'chmadi");
  assert.equal((await debt(d.id)).origin_transaction_id, null);
  const own = await newDebt({ ...base, direction: 'payable', amount: 5, origin_method: 'cash' });
  await owner('update public.debts set origin_transaction_id = $1 where id = $2', [victim[0].id, own.id]);
  assert.equal((await debtTransactions(own.id)).length, 1);
  const { rows: again } = await db.query('select amount::float from public.transactions where id = $1', [victim[0].id]);
  assert.deepEqual(again, [{ amount: 777 }], "boshqa biznes amali o'zgarmadi");
});

test('resetting origin id does not duplicate origin transaction', async () => {
  const d = await newDebt({ ...base, direction: 'payable', amount: 100, origin_method: 'cash' });
  await owner('update public.debts set origin_transaction_id = null where id = $1', [d.id]);
  assert.equal((await debtTransactions(d.id)).length, 1);
  assert.notEqual((await debt(d.id)).origin_transaction_id, null);
});

test('admin insert without a signed-in user records cash debt', async () => {
  const { rows: b } = await db.query('select business_id from public.business_members where user_id = $1', [OWNER]);
  const { rows } = await db.query(
    `insert into public.debts (business_id, user_id, direction, counterparty, amount, currency, due_date, origin_method)
     values ($1, $2, 'receivable', 'Admin', 10, 'UZS', '2026-11-30', 'card') returning id`,
    [b[0].business_id, OWNER],
  );
  const { rows: tx } = await db.query('select user_id from public.transactions where debt_id = $1', [rows[0].id]);
  assert.deepEqual(tx, [{ user_id: OWNER }]);
});
