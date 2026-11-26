import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { OrderRow } from '@/components/orders/OrderRow';
import { EmployeesSection, MyPayroll } from '@/components/payroll/EmployeesSection';
import { SalesSection } from '@/components/stock/SalesSection';
import { StockSection } from '@/components/stock/StockSection';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ORDER_STATUS_LABELS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useAccess } from '@/hooks/useMembership';
import { useOrders } from '@/hooks/useOrders';
import { formatOrderNumber } from '@/lib/orders';
import type { OrderStatus } from '@/types/database';
import type { OrderListItem } from '@/types/models';

type Section = 'orders' | 'employees' | 'mine' | 'stock' | 'sales';

// Egasi bo'limlari (keyin yangilari qo'shilsa — shu ro'yxatga).
const OWNER_SECTIONS: ReadonlyArray<[Section, string]> = [
  ['orders', TEXTS.flosso.orders],
  ['employees', TEXTS.flosso.employees],
  ['stock', TEXTS.stock.title],
  ['sales', TEXTS.sales.title],
];
type StatusFilter = OrderStatus | 'all';

const STATUS_FILTERS: ReadonlyArray<[StatusFilter, string]> = [
  ['all', TEXTS.common.all],
  ['new', ORDER_STATUS_LABELS.new],
  ['delivered', ORDER_STATUS_LABELS.delivered],
  ['cancelled', ORDER_STATUS_LABELS.cancelled],
];

function matches(order: OrderListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return true;
  }
  const digits = q.replace(/\D/g, '');
  return (
    order.customer_name.toLowerCase().includes(q) ||
    formatOrderNumber(order.number).includes(q) ||
    (digits.length > 0 && (String(order.number) === digits || (order.phone ?? '').replace(/\D/g, '').includes(digits)))
  );
}

// Flosso bo'limi: buyurtmalar (butun jamoa), xodimlar, ombor va sotuv (egasiga).
export default function FlossoScreen() {
  const access = useAccess();
  const [section, setSection] = useState<Section>('orders');
  const orders = useOrders();
  const { refreshing, onRefresh } = useManualRefresh([orders.refetch]);

  return (
    <Screen title={TEXTS.flosso.title} refreshing={refreshing} onRefresh={onRefresh}>
      <View className="mb-4">
        {access === 'owner' ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {OWNER_SECTIONS.map(([value, label]) => (
              <Chip key={value} label={label} selected={section === value} onPress={() => setSection(value)} />
            ))}
          </ScrollView>
        ) : (
          <SegmentedControl
            options={[
              { value: 'orders', label: TEXTS.flosso.orders },
              { value: 'mine', label: TEXTS.payroll.myTitle },
            ]}
            value={section}
            onChange={setSection}
          />
        )}
      </View>
      {section === 'orders' ? (
        <Orders orders={orders} onRetry={onRefresh} />
      ) : access !== 'owner' ? (
        <MyPayroll />
      ) : section === 'stock' ? (
        <StockSection />
      ) : section === 'sales' ? (
        <SalesSection />
      ) : (
        <EmployeesSection />
      )}
    </Screen>
  );
}

function Orders({ orders, onRetry }: { orders: ReturnType<typeof useOrders>; onRetry: () => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const renderList = () => {
    if (orders.isPending) {
      return <LoadingState />;
    }
    if (orders.isError) {
      return <ErrorState onRetry={onRetry} />;
    }
    if (orders.data.length === 0) {
      return <EmptyState title={TEXTS.orders.emptyTitle} message={TEXTS.orders.emptyMessage} />;
    }
    const visible = orders.data.filter((order) => (status === 'all' || order.status === status) && matches(order, query));
    if (visible.length === 0) {
      return <Text className="py-6 text-center text-base text-ink-muted">{TEXTS.orders.emptyFiltered}</Text>;
    }
    return (
      <Card className="py-1">
        {visible.map((order, index) => (
          <View key={order.id} className={index > 0 ? 'border-t border-line' : ''}>
            <OrderRow order={order} />
          </View>
        ))}
      </Card>
    );
  };

  return (
    <View className="gap-4">
      <Button title={TEXTS.orders.add} onPress={() => router.push('/order/new')} />
      <Input
        placeholder={TEXTS.orders.searchPlaceholder}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {STATUS_FILTERS.map(([value, label]) => (
          <Chip key={value} label={label} selected={status === value} onPress={() => setStatus(value)} />
        ))}
      </ScrollView>
      {renderList()}
    </View>
  );
}
