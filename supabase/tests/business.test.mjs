import assert from 'node:assert/strict';
import { before, test } from 'node:test';

import { applyMigration, as, createDb, signUp, uuid } from './harness.mjs';

const BEFORE_TEAM = '20261108090000_cash_card_debts.sql';
const TEAM = '20261108150000_business_team.sql';

const OWNER = uuid(1); // migratsiyadan oldin ro'yxatdan o'tgan egasi
const NEW_OWNER = uuid(2);
const SELLER = uuid(3);
const STRANGER = uuid(4);

let db;

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `kutilgan xato ${code}, keldi ${error.code}: ${error.message}`);
    return true;
  });
}

before(async () => {
  db = await createDb({ upTo: BEFORE_TEAM });
  await signUp(db, OWNER, 'Egasi');
  // Eski ilova: amal va qarz egasi nomidan yoziladi.
  await as(
    db,
    OWNER,
    `insert into public.transactions (type, amount, currency, payment_method, category_id)
     select 'income', 1000, 'UZS', 'cash', id from public.categories where type = 'income' limit 1`,
  );
  await as(db, OWNER, "insert into public.transactions (type, amount, currency) values ('expense', 250, 'UZS')");
  await as(
    db,
    OWNER,
    "insert into public.debts (direction, counterparty, amount, currency, due_date) values ('payable', 'Ali', 500, 'USD', current_date)",
  );
  await applyMigration(db, TEAM);
});

test('existing data migrates to owner business', async () => {
  const { rows: members } = await db.query('select business_id, role, status from public.business_members where user_id = $1', [OWNER]);
  assert.equal(members.length, 1);
  assert.equal(members[0].role, 'owner');
  assert.equal(members[0].status, 'active');
  const businessId = members[0].business_id;
  for (const table of ['categories', 'transactions', 'debts']) {
    const { rows } = await db.query(`select count(*)::int as n from public.${table} where business_id is distinct from $1`, [businessId]);
    assert.equal(rows[0].n, 0, `${table} hammasi egasining biznesida`);
  }
  const { rows: balance } = await as(db, OWNER, "select balance::float from public.balances where currency = 'UZS'");
  assert.equal(balance[0].balance, 750);
});

test('owner keeps full finance access', async () => {
  await as(db, OWNER, "insert into public.transactions (type, amount, currency) values ('income', 5, 'USD')");
  const { rows } = await as(db, OWNER, 'select count(*)::int as n from public.transactions');
  assert.equal(rows[0].n, 3);
  const { rows: debts } = await as(db, OWNER, 'select count(*)::int as n from public.debts');
  assert.equal(debts[0].n, 1);
});

test('create_business makes owner with 6-char code and debt categories', async () => {
  await signUp(db, NEW_OWNER, 'Yangi');
  const { rows } = await as(db, NEW_OWNER, "select * from public.create_business('Flosso Toshkent')");
  assert.equal(rows[0].name, 'Flosso Toshkent');
  assert.match(rows[0].join_code, /^[A-HJ-NP-Z2-9]{6}$/);
  const { rows: cats } = await as(db, NEW_OWNER, 'select name from public.categories order by name');
  assert.equal(cats.length, 2);
  const { rows: others } = await as(db, NEW_OWNER, 'select count(*)::int as n from public.transactions');
  assert.equal(others[0].n, 0, "boshqa biznes amallari ko'rinmaydi");
});

test('join errors', async () => {
  await signUp(db, STRANGER, 'Begona');
  await rejects(as(db, STRANGER, "select public.join_business('ZZZZZZ')"), 'FB002');
  await rejects(as(db, OWNER, "select public.create_business('Ikkinchi')"), 'FB001');
});

test('pending member has no access until approved', async () => {
  const { rows: biz } = await db.query('select join_code from public.businesses where owner_id = $1', [OWNER]);
  await signUp(db, SELLER, 'Sotuvchi');
  await as(db, SELLER, 'select public.join_business($1)', [biz[0].join_code.toLowerCase()]);
  await rejects(as(db, SELLER, 'select public.join_business($1)', [biz[0].join_code]), 'FB001');
  const { rows: pending } = await as(db, SELLER, 'select status from public.business_members');
  assert.deepEqual(pending, [{ status: 'pending' }]);
  const { rows: name } = await as(db, SELLER, 'select name from public.businesses');
  assert.equal(name[0].name, 'Flosso');
  await as(db, OWNER, 'select public.approve_member($1)', [SELLER]);
  const { rows: active } = await as(db, SELLER, 'select role, status from public.business_members where user_id = $1', [SELLER]);
  assert.deepEqual(active, [{ role: 'seller', status: 'active' }]);
});

test('seller sees no finance rows and cannot insert', async () => {
  for (const table of ['transactions', 'debts', 'categories', 'balances']) {
    const { rows } = await as(db, SELLER, `select count(*)::int as n from public.${table}`);
    assert.equal(rows[0].n, 0, `sotuvchi ${table} ni ko'rmaydi`);
  }
  await rejects(as(db, SELLER, "insert into public.transactions (type, amount, currency) values ('income', 1, 'UZS')"), '42501');
});

test('seller cannot approve or remove', async () => {
  await rejects(as(db, SELLER, 'select public.approve_member($1)', [SELLER]), 'FB003');
  await rejects(as(db, SELLER, 'select public.remove_member($1)', [OWNER]), 'FB003');
});

test('owner cannot be removed', async () => {
  await rejects(as(db, OWNER, 'select public.remove_member($1)', [OWNER]), 'FB004');
  await rejects(as(db, OWNER, 'select public.leave_business()'), 'FB004');
});

test('owner sees member names', async () => {
  const { rows } = await as(
    db,
    OWNER,
    `select u.full_name, m.role from public.business_members m join public.users u on u.id = m.user_id order by m.role`,
  );
  assert.deepEqual(rows, [
    { full_name: 'Egasi', role: 'owner' },
    { full_name: 'Sotuvchi', role: 'seller' },
  ]);
});

test('leave_business removes seller', async () => {
  await as(db, SELLER, 'select public.leave_business()');
  const { rows } = await db.query('select count(*)::int as n from public.business_members where user_id = $1', [SELLER]);
  assert.equal(rows[0].n, 0);
  await rejects(as(db, OWNER, 'select public.remove_member($1)', [SELLER]), 'FB005');
});

test('pay_debt still records transaction in owner business', async () => {
  const { rows: debt } = await as(db, OWNER, 'select id, business_id from public.debts limit 1');
  await as(db, OWNER, "select public.pay_debt($1, 'card')", [debt[0].id]);
  const { rows } = await as(
    db,
    OWNER,
    `select t.business_id, t.type, c.name from public.debts d
     join public.transactions t on t.id = d.transaction_id
     join public.categories c on c.id = t.category_id where d.id = $1`,
    [debt[0].id],
  );
  assert.equal(rows[0].business_id, debt[0].business_id);
  assert.equal(rows[0].type, 'expense');
  assert.equal(rows[0].name, "Kompaniya berishi kerak bo'lgan qarzlar");
});

test('team migration runs in an explicit transaction', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL(`../migrations/${TEAM}`, import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '')
    .trim();
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;$/i);
});
