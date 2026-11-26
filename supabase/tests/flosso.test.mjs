import assert from 'node:assert/strict';
import { before, test } from 'node:test';

import { as, createDb, signUp, uuid } from './harness.mjs';

const OWNER = uuid(81);
const SELLER = uuid(82);
let db;

const owner = (sql, params) => as(db, OWNER, sql, params);

before(async () => {
  db = await createDb();
  await signUp(db, OWNER, 'Egasi');
  const { rows } = await owner("select join_code from public.create_business('Flosso')");
  await signUp(db, SELLER, 'Sotuvchi');
  await as(db, SELLER, 'select public.join_business($1)', [rows[0].join_code]);
  await owner('select public.approve_member($1)', [SELLER]);
});

test('new business gets the flosso.uz catalog with codes and prices', async () => {
  const { rows } = await owner(
    "select product_type::text as type, count(*)::int as n from public.stock_items where kind = 'product' and code is not null group by 1 order by 1",
  );
  assert.deepEqual(rows, [
    { type: 'karniz', n: 9 },
    { type: 'kolonna_igrushka', n: 7 },
    { type: 'nalichnik', n: 12 },
    { type: 'nalichnik_igrushka', n: 6 },
    { type: 'podokonnik', n: 11 },
    { type: 'taroq_kolonna', n: 7 },
    { type: 'termopanel', n: 4 },
  ]);
  const { rows: one } = await owner("select name, unit::text, price::float from public.stock_items where code = 'FKR01-718'");
  assert.deepEqual(one, [{ name: 'Karniz, 1-model, 7×18 sm', unit: 'metr', price: 52700 }]);
  const { rows: toy } = await owner("select unit::text from public.stock_items where code = 'FIK(T)07-818'");
  assert.deepEqual(toy, [{ unit: 'dona' }]);
});

test('seller sees the catalog for orders', async () => {
  const { rows } = await as(db, SELLER, "select count(*)::int as n from public.stock_items where kind = 'product'");
  assert.equal(rows[0].n, 56);
});

test('catalog is seeded once: deleted products do not come back', async () => {
  await owner("delete from public.stock_items where code = 'FTP02-440'");
  await owner('select public.ensure_stock_defaults()');
  const { rows } = await owner("select count(*)::int as n from public.stock_items where kind = 'product'");
  assert.equal(rows[0].n, 55);
});

test('codes are normalized and unique per business', async () => {
  const { rows } = await owner(
    "insert into public.stock_items (kind, product_type, name, unit, code, price) values ('product', 'karniz', 'Karniz maxsus', 'metr', '  fkr99-718 ', 1000) returning code",
  );
  assert.equal(rows[0].code, 'FKR99-718');
  await assert.rejects(
    owner("insert into public.stock_items (kind, product_type, name, unit, code) values ('product', 'karniz', 'Boshqa nom', 'metr', 'FKR99-718')"),
    (error) => error.code === '23505',
  );
});

test('stock catalog seeds table is not exposed to clients', async () => {
  await assert.rejects(owner('select * from public.stock_catalog_seeds'), (error) => error.code === '42501');
});
