-- =====================================================================
-- Flosso — yangi enum qiymatlari (alohida fayl: Postgres yangi enum qiymatini
-- qo'shilgan tranzaksiyaning o'zida ishlatishga ruxsat bermaydi).
--   product_type: Flosso katalogi bo'limlari
--   stock_unit:   metr (karniz, nalichnik va boshqalar metrlab sotiladi)
-- =====================================================================

alter type public.product_type add value if not exists 'karniz';
alter type public.product_type add value if not exists 'nalichnik';
alter type public.product_type add value if not exists 'kolonna_igrushka';
alter type public.product_type add value if not exists 'nalichnik_igrushka';
alter type public.product_type add value if not exists 'podokonnik';
alter type public.product_type add value if not exists 'taroq_kolonna';
alter type public.product_type add value if not exists 'termopanel';

alter type public.stock_unit add value if not exists 'metr';
