import assert from 'node:assert/strict';
import { before, test } from 'node:test';

import { as, createDb, signUp, uuid } from './harness.mjs';

const OWNER = uuid(51);
let db;

const owner = (sql, params) => as(db, OWNER, sql, params);

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `kutilgan xato ${code}, keldi ${error.code}: ${error.message}`);
    return true;
  });
}

async function newDebt(amount, currency) {
  const { rows } = await owner(
    "insert into public.debts (direction, counterparty, amount, currency, due_date) values ('payable', 'Ali', $1, $2, '2026-11-30') returning id",
    [amount, currency],
  );
  return rows[0].id;
}

const pay = (debtId, amount, currency, rate) =>
  owner('select public.add_debt_payment($1, $2, $3, now(), $4, $5) as id', [debtId, amount, 'cash', currency, rate]);

async function paidAt(debtId) {
  const { rows } = await owner('select paid_at from public.debts where id = $1', [debtId]);
  return rows[0].paid_at;
}

before(async () => {
  db = await createDb();
  await signUp(db, OWNER, 'Egasi');
  await owner("select public.create_business('Flosso')");
});

test('UZS debt paid partly in dollars by stamped rate', async () => {
  const debtId = await newDebt(2400000, 'UZS');
  await pay(debtId, 100, 'USD', 12000);
  assert.equal(await paidAt(debtId), null);
  await rejects(pay(debtId, 101, 'USD', 12000), 'FD001');
  await pay(debtId, 1200000, 'UZS', null);
  assert.notEqual(await paidAt(debtId), null);
  const { rows } = await owner(
    'select t.amount::float, t.currency from public.transactions t where t.debt_id = $1 order by t.currency::text',
    [debtId],
  );
  assert.deepEqual(rows, [
    { amount: 100, currency: 'USD' },
    { amount: 1200000, currency: 'UZS' },
  ]);
});

test('USD debt closed with som payment', async () => {
  const debtId = await newDebt(50, 'USD');
  await pay(debtId, 600000, 'UZS', 12000);
  assert.notEqual(await paidAt(debtId), null);
});

test('foreign-currency payment requires a realistic rate', async () => {
  const debtId = await newDebt(100, 'USD');
  await rejects(pay(debtId, 1000, 'UZS', null), 'FO003');
  await rejects(pay(debtId, 1000, 'UZS', 1), 'FO003');
});

test('old 4-argument call still pays in debt currency', async () => {
  const debtId = await newDebt(300, 'USD');
  await owner("select public.add_debt_payment($1, 300, 'card')", [debtId]);
  const { rows } = await owner('select currency, rate_uzs_per_usd from public.debt_payments where debt_id = $1', [debtId]);
  assert.deepEqual(rows, [{ currency: 'USD', rate_uzs_per_usd: null }]);
  assert.notEqual(await paidAt(debtId), null);
});

test('amount edit compares against converted payments', async () => {
  const debtId = await newDebt(2400000, 'UZS');
  await pay(debtId, 100, 'USD', 12000);
  await rejects(owner('update public.debts set amount = 1000000 where id = $1', [debtId]), 'FD002');
  await owner('update public.debts set amount = 1200000 where id = $1', [debtId]);
  assert.notEqual(await paidAt(debtId), null);
});

test('pay_debt pays remainder in debt currency after a dollar payment', async () => {
  const debtId = await newDebt(2400000, 'UZS');
  await pay(debtId, 50, 'USD', 12000);
  await owner("select public.pay_debt($1, 'cash')", [debtId]);
  const { rows } = await owner(
    "select amount::float from public.debt_payments where debt_id = $1 and currency = 'UZS'",
    [debtId],
  );
  assert.deepEqual(rows, [{ amount: 1800000 }]);
});

test('tiny foreign payment is rejected and cannot unlock currency', async () => {
  const debtId = await newDebt(100, 'USD');
  await rejects(pay(debtId, 1, 'UZS', 12700), '23514');
  await pay(debtId, 127000, 'UZS', 12700);
  await rejects(owner("update public.debts set direction = 'receivable' where id = $1", [debtId]), 'FD003');
});

test('UZS debt fully closed with dollars at an odd rate', async () => {
  const debtId = await newDebt(1000000, 'UZS');
  await rejects(pay(debtId, 78.76, 'USD', 12700), 'FD001');
  await pay(debtId, 78.75, 'USD', 12700);
  assert.notEqual(await paidAt(debtId), null);
  await owner("update public.debts set note = 'yopildi' where id = $1", [debtId]);
});
