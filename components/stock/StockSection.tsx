import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useEnsureStockDefaults, useStockItems, type StockItemWithBalance } from '@/hooks/useStock';
import { formatMoney } from '@/lib/format';
import type { ProductType } from '@/types/database';

type Part = 'products' | 'materials';

export function formatQty(value: number, unit: string): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
  return `${text.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${unit}`;
}

// 52700, 'metr' -> "52 700 so'm / metr"
export function formatPrice(price: number, unit: string): string {
  return `${formatMoney(price, 'UZS')} ${TEXTS.stock.perUnit} ${unit}`;
}

export function qtyTone(item: StockItemWithBalance): string {
  if (item.quantity === null) {
    return 'text-ink';
  }
  if (item.quantity < 0) {
    return 'text-expense';
  }
  return item.min_qty > 0 && item.quantity < item.min_qty ? 'text-warning' : 'text-income';
}

export function CodeBadge({ code }: { code: string }) {
  return (
    <View className="rounded-md bg-primary-soft px-1.5 py-0.5">
      <Text className="text-xs font-bold tracking-wide text-primary">{code}</Text>
    </View>
  );
}

function StockRow({ item }: { item: StockItemWithBalance }) {
  const quantity = item.quantity ?? 0;
  const low = item.min_qty > 0 && quantity < item.min_qty;
  const status = [quantity < 0 ? TEXTS.stock.negative : low ? TEXTS.stock.lowStock : null, item.active ? null : TEXTS.stock.inactive]
    .filter((part) => part !== null)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/stock/[id]', params: { id: item.id } })}
      className="flex-row items-center gap-3 py-3 active:opacity-60"
    >
      <View className={`flex-1 gap-1 ${item.active ? '' : 'opacity-50'}`}>
        <Text numberOfLines={2} className="text-base font-semibold text-ink">
          {item.name}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          {item.code !== null ? <CodeBadge code={item.code} /> : null}
          {item.price !== null ? <Text className="text-sm text-ink-muted">{formatPrice(item.price, item.unit)}</Text> : null}
          {status.length > 0 ? <Text className="text-sm text-warning">{status}</Text> : null}
        </View>
      </View>
      <Text className={`text-base font-bold ${qtyTone(item)}`}>{formatQty(quantity, item.unit)}</Text>
    </Pressable>
  );
}

function Group({ title, items }: { title: string; items: StockItemWithBalance[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-lg font-bold text-ink">
        {title} <Text className="text-base font-medium text-ink-subtle">({items.length})</Text>
      </Text>
      <Card className="py-1">
        {items.map((item, index) => (
          <View key={item.id} className={index > 0 ? 'border-t border-line' : ''}>
            <StockRow item={item} />
          </View>
        ))}
      </Card>
    </View>
  );
}

function matches(item: StockItemWithBalance, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q.length === 0 || item.name.toLowerCase().includes(q) || (item.code ?? '').toLowerCase().includes(q);
}

// 1-qism: Flosso mahsulotlari — turlari bo'yicha guruhlab, kod va narx bilan.
function ProductsPart({ items }: { items: StockItemWithBalance[] }) {
  const [query, setQuery] = useState('');
  if (items.length === 0) {
    return <EmptyState title={TEXTS.stock.products} message={TEXTS.stock.empty} />;
  }
  const visible = items.filter((item) => matches(item, query));
  const known = new Set<ProductType>(PRODUCT_TYPE_OPTIONS.map((option) => option.value));
  const groups: [string, StockItemWithBalance[]][] = [
    ...PRODUCT_TYPE_OPTIONS.map(({ value, label }): [string, StockItemWithBalance[]] => [
      label,
      visible.filter((item) => item.product_type === value),
    ]),
    // Eski turlar yoki turi yo'q mahsulotlar — oxirida.
    ...Object.entries(PRODUCT_TYPE_LABELS)
      .filter(([value]) => !known.has(value as ProductType))
      .map(([value, label]): [string, StockItemWithBalance[]] => [label, visible.filter((item) => item.product_type === value)]),
    [TEXTS.stock.kindProduct, visible.filter((item) => item.product_type === null)],
  ];
  return (
    <View className="gap-4">
      <Text className="text-sm text-ink-muted">{TEXTS.stock.productsHint}</Text>
      <Input
        placeholder={TEXTS.stock.searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {visible.length === 0 ? <Text className="py-6 text-center text-base text-ink-muted">{TEXTS.stock.emptySearch}</Text> : null}
      {groups.map(([title, list]) => (
        <Group key={title} title={title} items={list} />
      ))}
    </View>
  );
}

// 2-qism: penadekor ishlab chiqarish xomashyosi.
function MaterialsPart({ items }: { items: StockItemWithBalance[] }) {
  return (
    <View className="gap-4">
      <Text className="text-sm text-ink-muted">{TEXTS.stock.materialsHint}</Text>
      {items.length === 0 ? (
        <EmptyState title={TEXTS.stock.materials} message={TEXTS.stock.emptyMaterials} />
      ) : (
        <Group title={TEXTS.stock.materials} items={items} />
      )}
    </View>
  );
}

// Egasi: ombor — 1-qism mahsulotlar, 2-qism xomashyo.
export function StockSection() {
  useEnsureStockDefaults(true);
  const stock = useStockItems();
  const [part, setPart] = useState<Part>('products');

  return (
    <View className="gap-4">
      <SegmentedControl
        options={[
          { value: 'products', label: TEXTS.stock.part1 },
          { value: 'materials', label: TEXTS.stock.part2 },
        ]}
        value={part}
        onChange={setPart}
      />
      <Button title={TEXTS.stock.add} onPress={() => router.push({ pathname: '/stock/new', params: { kind: part === 'materials' ? 'material' : 'product' } })} />
      {part === 'products' ? <Text className="text-sm text-ink-muted">{TEXTS.stock.autoHint}</Text> : null}
      {stock.isPending ? (
        <LoadingState />
      ) : stock.isError ? (
        <ErrorState onRetry={() => void stock.refetch()} />
      ) : part === 'products' ? (
        <ProductsPart items={stock.data.filter((item) => item.kind === 'product')} />
      ) : (
        <MaterialsPart items={stock.data.filter((item) => item.kind === 'material')} />
      )}
    </View>
  );
}
