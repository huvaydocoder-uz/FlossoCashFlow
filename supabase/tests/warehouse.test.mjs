import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, test } from 'node:test';

import { as, createDb, signUp, uuid } from './harness.mjs';

const OWNER = uuid(71);
const SELLER = uuid(72);
const OTHER = uuid(73);
let db;
let rezka;
let foreignItem;

const owner = (sql, params) => as(db, OWNER, sql, params);

async function rejects(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code, `kutilgan xato ${code}, keldi ${error.code}: ${error.message}`);
    return true;
  });
}

async function qty(itemId) {
  const { rows } = await owner('select quantity::float from public.stock_balances where stock_item_id = $1', [itemId]);
  return rows[0]?.quantity ?? 0;
}

async function material(key) {
  const { rows } = await owner('select id from public.stock_items where system_key = $1', [key]);
  return rows[0].id;
}

async function order(userId, fields, items) {
  const { rows } = await as(
    db,
    userId,
    "insert into public.orders (customer_name, agreed_price, currency, penoplast_count, sand_kg, chemicals_kg) values ('Mijoz', $1, 'USD', $2, $3, $4) returning id",
    [fields.price ?? 1000, fields.penoplast ?? 0, fields.sand ?? 0, fields.chemicals ?? 0],
  );
  for (const item of items) {
    await as(
      db,
      userId,
      'insert into public.order_items (order_id, product_type, name, quantity, stock_item_id) values ($1, $2, $3, $4, $5)',
      [rows[0].id, item.type ?? 'rezka', item.name ?? 'Rezka 40', item.quantity, item.stock ?? null],
    );
  }
  return rows[0].id;
}

const setStatus = (userId, id, status) => as(db, userId, 'update public.orders set status = $1 where id = $2', [status, id]);

before(async () => {
  db = await createDb();
  await signUp(db, OWNER, 'Farid');
  const { rows } = await owner("select join_code from public.create_business('Flosso')");
  await signUp(db, SELLER, 'Aziz');
  await as(db, SELLER, 'select public.join_business($1)', [rows[0].join_code]);
  await owner('select public.approve_member($1)', [SELLER]);
  await owner('select public.ensure_stock_defaults()');
  const { rows: item } = await owner(
    "insert into public.stock_items (kind, product_type, name, unit, min_qty) values ('product', 'rezka', 'Rezka 40x60', 'dona', 50) returning id",
  );
  rezka = item[0].id;
  await owner("insert into public.stock_movements (stock_item_id, direction, quantity, reason) values ($1, 'in', 500, 'production')", [rezka]);
  await signUp(db, OTHER, 'Begona');
  await as(db, OTHER, "select public.create_business('Boshqa')");
  const { rows: other } = await as(db, OTHER, "insert into public.stock_items (kind, name, unit) values ('product', 'X', 'dona') returning id");
  foreignItem = other[0].id;
});

test('defaults create five Flosso raw materials once', async () => {
  await owner('select public.ensure_stock_defaults()');
  const { rows } = await owner("select system_key, name, unit from public.stock_items where system_key is not null order by system_key");
  assert.deepEqual(rows, [
    { system_key: 'dots', name: 'Dots', unit: 'kg' },
    { system_key: 'penoplast_block', name: 'Penoplast blok', unit: 'dona' },
    { system_key: 'sand', name: 'Qum', unit: 'kg' },
    { system_key: 'texanol', name: 'Teksanol', unit: 'kg' },
    { system_key: 'thickener_k29', name: 'Zagustitel K-29', unit: 'kg' },
  ]);
});

test('delivery moves stock once and reverts', async () => {
  const id = await order(SELLER, { penoplast: 20, sand: 50.5 }, [{ quantity: 120, stock: rezka }, { quantity: 3, name: 'Erkin nom' }]);
  await setStatus(SELLER, id, 'delivered');
  assert.equal(await qty(rezka), 380);
  assert.equal(await qty(await material('penoplast')), -20);
  assert.equal(await qty(await material('sand')), -50.5);
  await as(db, SELLER, "update public.orders set note = 'yana' where id = $1", [id]);
  assert.equal(await qty(rezka), 380, 'ikki marta ayirilmaydi');
  await setStatus(SELLER, id, 'new');
  assert.equal(await qty(rezka), 500);
  await setStatus(SELLER, id, 'delivered');
  await setStatus(OWNER, id, 'cancelled');
  assert.equal(await qty(rezka), 500);
  assert.equal(await qty(await material('penoplast')), 0);
});

test('editing delivered order resyncs stock', async () => {
  const id = await order(SELLER, { chemicals: 2 }, [{ quantity: 10, stock: rezka }]);
  await setStatus(SELLER, id, 'delivered');
  assert.equal(await qty(rezka), 490);
  await as(db, SELLER, 'update public.order_items set quantity = 30 where order_id = $1', [id]);
  assert.equal(await qty(rezka), 470);
  await as(db, SELLER, 'update public.orders set chemicals_kg = 5 where id = $1', [id]);
  assert.equal(await qty(await material('chemicals')), -5);
  await as(db, SELLER, 'delete from public.order_items where order_id = $1', [id]);
  assert.equal(await qty(rezka), 500);
  await owner('delete from public.orders where id = $1', [id]);
  assert.equal(await qty(await material('chemicals')), 0);
});

test('stock visibility and forging', async () => {
  const { rows: names } = await as(db, SELLER, 'select name from public.stock_items order by name');
  assert.ok(names.some((r) => r.name === 'Rezka 40x60'));
  assert.ok(!names.some((r) => r.name === 'X'), "begona katalog ko'rinmaydi");
  const { rows: moves } = await as(db, SELLER, 'select count(*)::int as n from public.stock_movements');
  assert.equal(moves[0].n, 0);
  const { rows: bal } = await as(db, SELLER, 'select count(*)::int as n from public.stock_balances');
  assert.equal(bal[0].n, 0);
  await rejects(as(db, SELLER, "insert into public.stock_items (kind, name, unit) values ('product', 'Y', 'dona')"), '42501');
  const id = await order(SELLER, {}, [{ quantity: 5, stock: foreignItem }]);
  const { rows } = await as(db, SELLER, 'select stock_item_id from public.order_items where order_id = $1', [id]);
  assert.equal(rows[0].stock_item_id, null, "begona katalogga bog'lanmaydi");
});

test('manual movements cannot impersonate orders', async () => {
  const id = await order(OWNER, {}, []);
  await rejects(
    owner("insert into public.stock_movements (stock_item_id, direction, quantity, reason, order_id) values ($1, 'out', 1, 'writeoff', $2)", [rezka, id]),
    '42501',
  );
  await rejects(owner("insert into public.stock_movements (stock_item_id, direction, quantity, reason) values ($1, 'out', 1, 'order')", [rezka]), '42501');
  await owner("insert into public.stock_movements (stock_item_id, direction, quantity, reason) values ($1, 'out', 2, 'writeoff')", [rezka]);
  assert.equal(await qty(rezka), 498);
});

test('item with movements cannot be deleted', async () => {
  await rejects(owner('delete from public.stock_items where id = $1', [rezka]), 'FW001');
});

test('sales report aggregates by month and seller', async () => {
  const a = await order(SELLER, { price: 1000 }, [{ quantity: 7, stock: rezka }]);
  await as(db, SELLER, "select public.add_order_payment($1, 400, 'USD', 'cash', 12000)", [a]);
  const c = await order(SELLER, { price: 9999 }, []);
  await setStatus(OWNER, c, 'cancelled');
  const { rows } = await owner("select * from public.sales_report(date_trunc('month', current_date)::date, current_date) where seller_id = $1", [SELLER]);
  const row = rows[0];
  assert.equal(Number(row.paid_usd), 400);
  assert.equal(Number(row.agreed_usd) >= 1000, true);
  assert.equal(Number(row.cancelled_count) >= 1, true);
  const { rows: top } = await owner("select name, quantity::float from public.top_products(date_trunc('month', current_date)::date, current_date) where stock_item_id = $1", [rezka]);
  assert.ok(top[0].quantity >= 7);
  await rejects(as(db, SELLER, "select * from public.sales_report(current_date, current_date)"), 'FB003');
});

test('warehouse migration runs in an explicit transaction', () => {
  const sql = readFileSync(new URL('../migrations/20261109150000_warehouse.sql', import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '')
    .trim();
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;$/i);
});

test('client cannot claim or reshape a system material', async () => {
  const { rows } = await owner(
    "insert into public.stock_items (kind, name, unit, system_key) values ('material', 'Soxta qum', 'kg', 'sand') returning system_key",
  );
  assert.equal(rows[0].system_key, null);
  const sand = await material('sand');
  await owner("update public.stock_items set name = 'Boshqa', unit = 'dona', kind = 'product' where id = $1", [sand]);
  const { rows: after } = await owner('select name, unit, kind from public.stock_items where id = $1', [sand]);
  assert.deepEqual(after, [{ name: 'Qum', unit: 'kg', kind: 'material' }]);
});

test('same-name material is adopted as the system material', async () => {
  const fresh = uuid(74);
  await signUp(db, fresh, 'Yangi');
  await as(db, fresh, "select public.create_business('Yangi biznes')");
  // Biznes yaratilganda Qum allaqachon bor — o'chirib, qo'lda shu nom bilan qo'shamiz.
  await as(db, fresh, "delete from public.stock_items where system_key = 'sand'");
  await as(db, fresh, "insert into public.stock_items (kind, name, unit) values ('material', 'Qum', 'kg')");
  await as(db, fresh, 'select public.ensure_stock_defaults()');
  const { rows } = await as(db, fresh, "select system_key from public.stock_items where lower(name) = 'qum'");
  assert.deepEqual(rows, [{ system_key: 'sand' }]);
});
