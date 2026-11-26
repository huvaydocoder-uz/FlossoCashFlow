import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';

import { as, createDb, signUp, uuid } from './harness.mjs';

const OWNER = uuid(41);
const SELLER_A = uuid(42);
const SELLER_B = uuid(43);
const OTHER_OWNER = uuid(44);

let db;

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `kutilgan xato ${code}, keldi ${error.code}: ${error.message}`);
    return true;
  });
}

async function newOrder(userId, fields = {}) {
  const row = { customer_name: 'Mijoz', agreed_price: 1000, currency: 'USD', ...fields };
  const cols = Object.keys(row);
  const { rows } = await as(
    db,
    userId,
    `insert into public.orders (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    Object.values(row),
  );
  return rows[0];
}

async function payOrder(userId, orderId, amount, currency, method = 'cash', rate = 12000, isAdvance = false) {
  const { rows } = await as(db, userId, 'select public.add_order_payment($1, $2, $3, $4, $5, $6) as id', [
    orderId,
    amount,
    currency,
    method,
    rate,
    isAdvance,
  ]);
  return rows[0].id;
}

async function listed(userId, orderId) {
  const { rows } = await as(db, userId, 'select * from public.order_list where id = $1', [orderId]);
  return rows[0];
}

before(async () => {
  db = await createDb();
  await signUp(db, OWNER, 'Farid');
  const { rows } = await as(db, OWNER, "select join_code from public.create_business('Flosso')");
  for (const [id, name] of [
    [SELLER_A, 'Aziz'],
    [SELLER_B, 'Bobur'],
  ]) {
    await signUp(db, id, name);
    await as(db, id, 'select public.join_business($1)', [rows[0].join_code]);
    await as(db, OWNER, 'select public.approve_member($1)', [id]);
  }
  await signUp(db, OTHER_OWNER, 'Begona');
  await as(db, OTHER_OWNER, "select public.create_business('Boshqa')");
});

test('order numbers per business', async () => {
  const first = await newOrder(OWNER);
  const second = await newOrder(SELLER_A);
  const foreign = await newOrder(OTHER_OWNER);
  assert.equal(second.number, first.number + 1);
  assert.equal(foreign.number, 1);
});

test('seller is stamped as order seller and cannot forge it', async () => {
  const order = await newOrder(SELLER_A, { seller_id: SELLER_B });
  assert.equal(order.seller_id, SELLER_A);
  const byOwner = await newOrder(OWNER, { seller_id: SELLER_B });
  assert.equal(byOwner.seller_id, SELLER_B, 'egasi sotuvchini tanlay oladi');
});

test("seller sees others' orders without money", async () => {
  const mine = await newOrder(SELLER_A, { agreed_price: 500, discount: 50, phone: '+998901112233' });
  const theirs = await listed(SELLER_B, mine.id);
  assert.equal(theirs.customer_name, 'Mijoz');
  assert.equal(theirs.phone, '+998901112233');
  assert.equal(theirs.seller_name, 'Aziz');
  assert.equal(theirs.agreed_price, null);
  assert.equal(theirs.discount, null);
  assert.equal(theirs.paid, null);
  assert.equal(theirs.remaining, null);
  const own = await listed(SELLER_A, mine.id);
  assert.equal(Number(own.remaining), 450);
  const { rows } = await as(db, SELLER_B, 'select count(*)::int as n from public.orders where id = $1', [mine.id]);
  assert.equal(rows[0].n, 0, "jadvaldan ham ko'rinmaydi");
  assert.equal(await listed(OTHER_OWNER, mine.id), undefined, "boshqa biznes ko'rmaydi");
});

test('seller edits only own order', async () => {
  const order = await newOrder(SELLER_A, { agreed_price: 300 });
  await as(db, SELLER_B, "update public.orders set customer_name = 'Buzildi' where id = $1", [order.id]);
  await as(db, SELLER_A, 'update public.orders set seller_id = $1, number = 999 where id = $2', [SELLER_B, order.id]);
  const { rows } = await db.query('select customer_name, seller_id, number from public.orders where id = $1', [order.id]);
  assert.equal(rows[0].customer_name, 'Mijoz');
  assert.equal(rows[0].seller_id, SELLER_A);
  assert.equal(rows[0].number, order.number);
  await rejects(as(db, SELLER_A, 'delete from public.orders where id = $1 returning id', [order.id]).then(({ rows: r }) => {
    if (r.length === 0) {
      const error = new Error('not deleted');
      error.code = 'NODEL';
      throw error;
    }
  }), 'NODEL');
});

test('cross-currency payment uses stamped rate', async () => {
  const order = await newOrder(OWNER, { agreed_price: 1000, discount: 100, currency: 'USD', seller_id: SELLER_A });
  await payOrder(SELLER_A, order.id, 1200000, 'UZS', 'cash', 12000, true);
  await payOrder(OWNER, order.id, 800, 'USD', 'card', 12100);
  const row = await listed(OWNER, order.id);
  assert.equal(Number(row.paid), 900);
  assert.equal(Number(row.remaining), 0);
  await rejects(payOrder(OWNER, order.id, 1, 'USD'), 'FO001');
  const { rows: payments } = await as(db, OWNER, 'select amount_usd::float, is_advance from public.order_payments where order_id = $1 order by paid_at, amount_usd', [order.id]);
  assert.deepEqual(payments.map((p) => p.amount_usd).sort(), [100, 800]);
  const { rows: tx } = await as(
    db,
    OWNER,
    `select t.type, t.amount::float, t.currency, t.payment_method, t.source, t.user_id, c.name as category
     from public.transactions t join public.categories c on c.id = t.category_id where t.order_id = $1 order by t.amount`,
    [order.id],
  );
  assert.deepEqual(tx, [
    { type: 'income', amount: 800, currency: 'USD', payment_method: 'card', source: 'order_payment', user_id: OWNER, category: "Buyurtma to'lovlari" },
    { type: 'income', amount: 1200000, currency: 'UZS', payment_method: 'cash', source: 'order_payment', user_id: SELLER_A, category: "Buyurtma to'lovlari" },
  ]);
});

test("seller cannot pay or see payments of others' orders", async () => {
  const order = await newOrder(SELLER_A, { agreed_price: 100 });
  await rejects(payOrder(SELLER_B, order.id, 10, 'USD'), 'FB003');
  await payOrder(SELLER_A, order.id, 10, 'USD');
  const { rows } = await as(db, SELLER_B, 'select count(*)::int as n from public.order_payments where order_id = $1', [order.id]);
  assert.equal(rows[0].n, 0);
});

test('deleting order payment removes transaction', async () => {
  const order = await newOrder(SELLER_A, { agreed_price: 100 });
  const paymentId = await payOrder(SELLER_A, order.id, 40, 'USD');
  await rejects(as(db, SELLER_A, 'select public.delete_order_payment($1)', [paymentId]), 'FB003');
  await as(db, OWNER, 'select public.delete_order_payment($1)', [paymentId]);
  const { rows } = await as(db, OWNER, 'select count(*)::int as n from public.transactions where order_id = $1', [order.id]);
  assert.equal(rows[0].n, 0);
  assert.equal(Number((await listed(OWNER, order.id)).remaining), 100);
});

test('deleting order removes its payments and transactions', async () => {
  const order = await newOrder(SELLER_A, { agreed_price: 100 });
  await payOrder(SELLER_A, order.id, 30, 'USD');
  await as(db, OWNER, 'delete from public.orders where id = $1', [order.id]);
  const { rows } = await db.query(
    'select (select count(*) from public.transactions where order_id = $1)::int as tx, (select count(*) from public.order_payments where order_id = $1)::int as p',
    [order.id],
  );
  assert.deepEqual(rows[0], { tx: 0, p: 0 });
});

test('items: visible to the team, editable by order seller', async () => {
  const order = await newOrder(SELLER_A);
  await as(db, SELLER_A, "insert into public.order_items (order_id, product_type, name, quantity) values ($1, 'rezka', 'Rezka 40', 3)", [order.id]);
  await rejects(
    as(db, SELLER_B, "insert into public.order_items (order_id, product_type, name, quantity) values ($1, 'quyma', 'X', 1)", [order.id]),
    '42501',
  );
  const { rows } = await as(db, SELLER_B, 'select product_type, name, quantity from public.order_items where order_id = $1', [order.id]);
  assert.deepEqual(rows, [{ product_type: 'rezka', name: 'Rezka 40', quantity: 3 }]);
  const { rows: foreign } = await as(db, OTHER_OWNER, 'select count(*)::int as n from public.order_items where order_id = $1', [order.id]);
  assert.equal(foreign[0].n, 0);
});

test('orders migration runs in an explicit transaction', () => {
  const sql = readFileSync(new URL('../migrations/20261108230000_orders.sql', import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '')
    .trim();
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;$/i);
});

test('payment rate must be realistic', async () => {
  const order = await newOrder(SELLER_A, { agreed_price: 1000 });
  await rejects(payOrder(SELLER_A, order.id, 1000, 'UZS', 'cash', 1), 'FO003');
  await rejects(payOrder(SELLER_A, order.id, 10, 'USD', 'cash', 999999), 'FO003');
});

test('price, discount and currency cannot undercut payments', async () => {
  const order = await newOrder(SELLER_A, { agreed_price: 1000, currency: 'USD' });
  await payOrder(SELLER_A, order.id, 800, 'USD');
  await rejects(as(db, SELLER_A, 'update public.orders set discount = 1000 where id = $1', [order.id]), 'FO004');
  await rejects(as(db, SELLER_A, 'update public.orders set agreed_price = 500 where id = $1', [order.id]), 'FO004');
  await rejects(as(db, SELLER_A, "update public.orders set currency = 'UZS' where id = $1", [order.id]), 'FO005');
  await as(db, SELLER_A, 'update public.orders set discount = 200 where id = $1', [order.id]);
});

test('payments rejected on cancelled orders', async () => {
  const order = await newOrder(SELLER_A, { agreed_price: 100 });
  await as(db, SELLER_A, "update public.orders set status = 'cancelled' where id = $1", [order.id]);
  await rejects(payOrder(SELLER_A, order.id, 10, 'USD'), 'FO006');
});

test('foreign user gets permission error, not existence hint', async () => {
  const order = await newOrder(OWNER, { agreed_price: 100 });
  await rejects(payOrder(OTHER_OWNER, order.id, 10, 'USD'), 'FB003');
  await rejects(payOrder(OTHER_OWNER, '00000000-0000-0000-0000-00000000dead', 10, 'USD'), 'FB003');
});

test('manual transaction cannot point at an order', async () => {
  const order = await newOrder(OWNER, { agreed_price: 100 });
  await rejects(
    as(db, OWNER, "insert into public.transactions (type, amount, currency, order_id) values ('income', 1, 'UZS', $1)", [order.id]),
    '42501',
  );
});

test('order id and created_at are pinned', async () => {
  const order = await newOrder(SELLER_A);
  await as(db, SELLER_A, "update public.orders set id = gen_random_uuid(), created_at = '2000-01-01' where id = $1", [order.id]);
  const { rows } = await db.query('select created_at from public.orders where id = $1', [order.id]);
  assert.equal(rows.length, 1);
  assert.notEqual(new Date(rows[0].created_at).getFullYear(), 2000);
});

test('removed seller loses access; owner still manages their orders', async () => {
  const gone = uuid(45);
  await signUp(db, gone, 'Ketgan');
  const { rows: code } = await as(db, OWNER, 'select join_code from public.businesses');
  await as(db, gone, 'select public.join_business($1)', [code[0].join_code]);
  await as(db, OWNER, 'select public.approve_member($1)', [gone]);
  const order = await newOrder(gone, { agreed_price: 300 });
  await as(db, OWNER, 'select public.remove_member($1)', [gone]);
  const { rows } = await as(db, gone, 'select count(*)::int as n from public.orders where id = $1', [order.id]);
  assert.equal(rows[0].n, 0);
  await as(db, OWNER, "update public.orders set status = 'delivered' where id = $1", [order.id]);
  const { rows: after } = await db.query('select status from public.orders where id = $1', [order.id]);
  assert.equal(after[0].status, 'delivered');
});
