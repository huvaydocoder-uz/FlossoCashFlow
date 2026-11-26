import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { AmountField } from '@/components/transaction/AmountField';
import { DateField } from '@/components/transaction/DateField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CURRENCY_OPTIONS, PAYMENT_METHOD_OPTIONS, PRODUCT_TYPE_OPTIONS } from '@/constants/options';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { useTeamMembers } from '@/hooks/useMembership';
import { useUsdRate } from '@/hooks/useOrders';
import { useStockItems } from '@/hooks/useStock';
import { addDays } from '@/lib/dates';
import { parseDueDate, toDueDateString } from '@/lib/debts';
import { formatAmountInput, parseAmountInput } from '@/lib/format';
import { toOrderCurrency } from '@/lib/orders';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { validatePhone } from '@/lib/validation';
import type { CurrencyCode, PaymentMethod, ProductType } from '@/types/database';
import type { AdvanceInput, OrderDetail, OrderItemInput, OrderPayload } from '@/types/models';

type ItemValues = { key: string; product_type: ProductType; name: string; quantity: string; stockItemId: string | null };

export type OrderFormValues = {
  customerName: string;
  phone: string;
  address: string;
  locationUrl: string;
  latitude: number | null;
  longitude: number | null;
  priceText: string;
  currency: CurrencyCode;
  discountText: string;
  orderDate: Date;
  deliveryDate: Date | null;
  sellerId: string | null;
  items: ItemValues[];
  freeDelivery: boolean;
  installation: boolean;
  training: boolean;
  molds: boolean;
  note: string;
  advanceText: string;
  advanceCurrency: CurrencyCode;
  advanceMethod: PaymentMethod;
  rateText: string;
};

type Errors = Partial<Record<'customer' | 'phone' | 'location' | 'price' | 'discount' | 'advance' | 'rate' | 'items', string>>;

let itemKey = 0;
const newItem = (): ItemValues => ({
  key: `item-${(itemKey += 1)}`,
  product_type: 'karniz',
  name: '',
  quantity: '1',
  stockItemId: null,
});
const digits = (text: string) => text.replace(/\D/g, '').slice(0, 7);
const decimal = (text: string) => formatAmountInput(text);

export function createEmptyOrderValues(): OrderFormValues {
  return {
    customerName: '',
    phone: '',
    address: '',
    locationUrl: '',
    latitude: null,
    longitude: null,
    priceText: '',
    currency: 'USD',
    discountText: '',
    orderDate: new Date(),
    deliveryDate: addDays(new Date(), 3),
    sellerId: null,
    items: [newItem()],
    freeDelivery: false,
    installation: false,
    training: false,
    molds: false,
    note: '',
    advanceText: '',
    advanceCurrency: 'USD',
    advanceMethod: 'cash',
    rateText: '',
  };
}

const amountText = (value: number | null) => (value === null || value === 0 ? '' : formatAmountInput(String(value).replace('.', ',')));

export function toOrderValues(order: OrderDetail): OrderFormValues {
  return {
    ...createEmptyOrderValues(),
    customerName: order.customer_name,
    phone: order.phone === null ? '' : formatPhone(order.phone),
    address: order.address ?? '',
    locationUrl: order.location_url ?? '',
    latitude: order.latitude,
    longitude: order.longitude,
    priceText: amountText(order.agreed_price),
    currency: order.currency ?? 'USD',
    discountText: amountText(order.discount),
    orderDate: parseDueDate(order.order_date),
    deliveryDate: order.delivery_date === null ? null : parseDueDate(order.delivery_date),
    sellerId: order.seller_id,
    items: order.items.map((item) => ({
      ...newItem(),
      product_type: item.product_type,
      name: item.name,
      quantity: String(item.quantity),
      stockItemId: item.stock_item_id,
    })),
    freeDelivery: order.free_delivery,
    installation: order.installation,
    training: order.training,
    molds: order.molds,
    note: order.note ?? '',
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-4">
      <Text accessibilityRole="header" className="text-lg font-bold text-ink">
        {title}
      </Text>
      {children}
    </Card>
  );
}

type OrderFormProps = {
  initial: OrderFormValues;
  isNew: boolean;
  isOwner: boolean;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (input: { payload: OrderPayload; items: OrderItemInput[]; advance: AdvanceInput | null }) => void;
};

// Buyurtma kartochkasi: mijoz, manzil, narx (+ avans yangi buyurtmada), sanalar, mahsulotlar, qo'shimchalar.
export function OrderForm({ initial, isNew, isOwner, submitting, submitError, onSubmit }: OrderFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const rate = useUsdRate(new Date());
  const team = useTeamMembers(isOwner);
  const stock = useStockItems();
  const catalog = (stock.data ?? []).filter((item) => item.kind === 'product' && item.active);
  const sellers = (team.data ?? []).filter((member) => member.status === 'active');

  // Markaziy bank kursi kelganda, kurs maydoni bo'sh bo'lsa — to'ldiramiz.
  useEffect(() => {
    if (typeof rate.data === 'number') {
      setValues((current) => (current.rateText === '' ? { ...current, rateText: formatAmountInput(String(rate.data).replace('.', ',')) } : current));
    }
  }, [rate.data]);

  const set = <K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors({});
  };

  const setItem = (key: string, patch: Partial<ItemValues>) =>
    set(
      'items',
      values.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );

  const takeLocation = () => {
    const geo = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (geo === undefined) {
      setLocationMessage(TEXTS.orders.locationFailed);
      return;
    }
    geo.getCurrentPosition(
      (position) => {
        setValues((current) => ({
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        }));
        setLocationMessage(TEXTS.orders.locationSaved);
      },
      () => setLocationMessage(TEXTS.orders.locationFailed),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handleSubmit = () => {
    const price = parseAmountInput(values.priceText);
    const discount = values.discountText.trim() === '' ? 0 : parseAmountInput(values.discountText);
    const advance = values.advanceText.trim() === '' ? 0 : parseAmountInput(values.advanceText);
    const rateValue = parseAmountInput(values.rateText);
    const name = values.customerName.trim();
    const url = values.locationUrl.trim();
    const next: Errors = {
      customer: name.length === 0 ? TEXTS.orders.customerRequired : name.length > 100 ? TEXTS.orders.customerTooLong : undefined,
      phone: validatePhone(values.phone),
      location: url.length > 0 && !/^https?:\/\//i.test(url) ? TEXTS.orders.urlInvalid : undefined,
      price: price === null || price <= 0 ? TEXTS.orders.priceRequired : undefined,
      discount: discount === null || (price !== null && discount > price) ? TEXTS.orders.discountTooBig : undefined,
      advance: advance === null ? TEXTS.validation.amountInvalid : undefined,
      rate: isNew && (advance ?? 0) > 0 && (rateValue === null || rateValue <= 0) ? TEXTS.orders.rateRequired : undefined,
      items: values.items.some((item) => item.name.trim().length === 0)
        ? TEXTS.orders.productNameRequired
        : values.items.some((item) => Number(item.quantity) < 1)
          ? TEXTS.orders.quantityInvalid
          : undefined,
    };
    if (
      next.advance === undefined &&
      isNew &&
      price !== null &&
      discount !== null &&
      advance !== null &&
      advance > 0 &&
      rateValue !== null &&
      toOrderCurrency(advance, values.advanceCurrency, values.currency, rateValue) > price - discount + 0.005
    ) {
      next.advance = TEXTS.dbErrors.orderOverpay;
    }
    setErrors(next);
    if (Object.values(next).some((message) => message !== undefined) || price === null || discount === null) {
      return;
    }
    const phone = normalizePhone(values.phone);
    const address = values.address.trim();
    const note = values.note.trim();
    const payload: OrderPayload = {
      customer_name: name,
      phone,
      address: address.length > 0 ? address : null,
      location_url: url.length > 0 ? url : null,
      latitude: values.latitude,
      longitude: values.longitude,
      agreed_price: price,
      discount,
      currency: values.currency,
      order_date: toDueDateString(values.orderDate),
      delivery_date: values.deliveryDate === null ? null : toDueDateString(values.deliveryDate),
      free_delivery: values.freeDelivery,
      installation: values.installation,
      training: values.training,
      molds: values.molds,
      note: note.length > 0 ? note : null,
      ...(isOwner && values.sellerId !== null ? { seller_id: values.sellerId } : {}),
    };
    const items = values.items.map((item) => ({
      product_type: item.product_type,
      name: item.name.trim(),
      quantity: Number(item.quantity),
      stock_item_id: item.stockItemId,
    }));
    onSubmit({
      payload,
      items,
      advance:
        isNew && advance !== null && advance > 0 && rateValue !== null
          ? { amount: advance, currency: values.advanceCurrency, method: values.advanceMethod, rate: rateValue }
          : null,
    });
  };

  const extras: ReadonlyArray<[keyof OrderFormValues & ('freeDelivery' | 'installation' | 'training' | 'molds'), string]> = [
    ['freeDelivery', TEXTS.orders.freeDelivery],
    ['installation', TEXTS.orders.installation],
    ['training', TEXTS.orders.training],
    ['molds', TEXTS.orders.molds],
  ];

  return (
    <View className="gap-4">
      {submitError !== null ? <FormMessage message={submitError} /> : null}

      <Section title={TEXTS.orders.sectionCustomer}>
        <Input
          label={TEXTS.orders.customerLabel}
          placeholder={TEXTS.orders.customerPlaceholder}
          value={values.customerName}
          onChangeText={(text) => set('customerName', text)}
          error={errors.customer}
          maxLength={100}
        />
        <PhoneInput
          label={TEXTS.orders.phoneLabel}
          value={values.phone}
          onChangeText={(text) => set('phone', text)}
          error={errors.phone}
        />
      </Section>

      <Section title={TEXTS.orders.sectionAddress}>
        <Input
          label={TEXTS.orders.addressLabel}
          placeholder={TEXTS.orders.addressPlaceholder}
          value={values.address}
          onChangeText={(text) => set('address', text)}
          maxLength={300}
        />
        <Input
          label={TEXTS.orders.locationLabel}
          placeholder={TEXTS.orders.locationPlaceholder}
          value={values.locationUrl}
          onChangeText={(text) => set('locationUrl', text)}
          error={errors.location}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
        />
        {Platform.OS === 'web' ? (
          <Button title={TEXTS.orders.useMyLocation} variant="secondary" onPress={takeLocation} />
        ) : null}
        {values.latitude !== null && values.longitude !== null ? (
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-sm text-ink-muted">
              {values.latitude}, {values.longitude}
            </Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={SIZES.hitSlop}
              onPress={() => {
                setValues((current) => ({ ...current, latitude: null, longitude: null }));
                setLocationMessage(null);
              }}
            >
              <Text className="text-sm font-semibold text-danger">{TEXTS.orders.clearLocation}</Text>
            </Pressable>
          </View>
        ) : null}
        {locationMessage !== null ? <Text className="text-sm text-ink-muted">{locationMessage}</Text> : null}
      </Section>

      <Section title={TEXTS.orders.sectionPrice}>
        <AmountField
          amountText={values.priceText}
          onChangeAmount={(text) => set('priceText', text)}
          currency={values.currency}
          onChangeCurrency={(currency) => {
            set('currency', currency);
          }}
          error={errors.price}
        />
        <Input
          label={TEXTS.orders.discountLabel}
          placeholder="0"
          value={values.discountText}
          onChangeText={(text) => set('discountText', decimal(text))}
          error={errors.discount}
          keyboardType="decimal-pad"
        />
        {isNew ? (
          <View className="gap-3">
            <Input
              label={TEXTS.orders.advanceLabel}
              placeholder="0"
              value={values.advanceText}
              onChangeText={(text) => set('advanceText', decimal(text))}
              error={errors.advance}
              keyboardType="decimal-pad"
            />
            <SegmentedControl options={CURRENCY_OPTIONS} value={values.advanceCurrency} onChange={(value) => set('advanceCurrency', value)} />
            <SegmentedControl options={PAYMENT_METHOD_OPTIONS} value={values.advanceMethod} onChange={(value) => set('advanceMethod', value)} />
            <Input
              label={TEXTS.orders.rateLabel}
              value={values.rateText}
              onChangeText={(text) => set('rateText', decimal(text))}
              error={errors.rate}
              keyboardType="decimal-pad"
            />
            <Text className="text-sm text-ink-muted">
              {rate.data === null ? TEXTS.orders.rateManual : TEXTS.orders.rateHint}. {TEXTS.orders.advanceHint}
            </Text>
          </View>
        ) : null}
      </Section>

      <Section title={TEXTS.orders.sectionDates}>
        <DateField label={TEXTS.orders.orderDateLabel} value={values.orderDate} onChange={(date) => set('orderDate', date)} />
        {values.deliveryDate !== null ? (
          <View className="gap-1">
            <DateField
              label={TEXTS.orders.deliveryDateLabel}
              allowFuture
              value={values.deliveryDate}
              onChange={(date) => set('deliveryDate', date)}
            />
            <Pressable accessibilityRole="button" hitSlop={SIZES.hitSlop} onPress={() => set('deliveryDate', null)}>
              <Text className="text-sm font-semibold text-danger">{TEXTS.orders.clearDelivery}</Text>
            </Pressable>
          </View>
        ) : (
          <Button
            title={TEXTS.orders.setDelivery}
            variant="secondary"
            onPress={() => set('deliveryDate', addDays(new Date(), 3))}
          />
        )}
        {isOwner && sellers.length > 0 ? (
          <View className="gap-2">
            <Text className="text-sm font-medium text-ink">{TEXTS.orders.sellerLabel}</Text>
            <View className="flex-row flex-wrap gap-2">
              {sellers.map((member) => (
                <Chip
                  key={member.userId}
                  label={member.fullName ?? TEXTS.team.noName}
                  selected={values.sellerId === member.userId}
                  onPress={() => set('sellerId', member.userId)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </Section>

      <Section title={TEXTS.orders.sectionProducts}>
        {values.items.map((item, index) => (
          <View key={item.key} className={`gap-3 ${index > 0 ? 'border-t border-line pt-4' : ''}`}>
            <View className="flex-row flex-wrap gap-2">
              {PRODUCT_TYPE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={item.product_type === option.value}
                  onPress={() => setItem(item.key, { product_type: option.value, stockItemId: null })}
                />
              ))}
            </View>
            {catalog.some((entry) => entry.product_type === item.product_type) ? (
              <View className="gap-2">
                <Text className="text-sm font-medium text-ink">{TEXTS.stock.pickFromStock}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {catalog
                    .filter((entry) => entry.product_type === item.product_type)
                    .map((entry) => (
                      <Chip
                        key={entry.id}
                        label={entry.code !== null ? `${entry.code} · ${entry.name}` : entry.name}
                        selected={item.stockItemId === entry.id}
                        onPress={() => setItem(item.key, { stockItemId: entry.id, name: entry.name })}
                      />
                    ))}
                  <Chip
                    label={TEXTS.stock.manualName}
                    selected={item.stockItemId === null}
                    onPress={() => setItem(item.key, { stockItemId: null })}
                  />
                </View>
              </View>
            ) : null}
            <View className="flex-row gap-3">
              <View className="flex-[2]">
                <Input
                  label={TEXTS.orders.productName}
                  placeholder={TEXTS.orders.productNamePlaceholder}
                  value={item.name}
                  onChangeText={(text) => setItem(item.key, { name: text, stockItemId: null })}
                  maxLength={100}
                />
              </View>
              <View className="flex-1">
                <Input
                  label={TEXTS.orders.quantityLabel}
                  value={item.quantity}
                  onChangeText={(text) => setItem(item.key, { quantity: digits(text) })}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            {values.items.length > 1 ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={SIZES.hitSlop}
                onPress={() => set('items', values.items.filter((other) => other.key !== item.key))}
              >
                <Text className="text-sm font-semibold text-danger">{TEXTS.orders.removeProduct}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        {errors.items !== undefined ? <Text className="text-sm text-danger">{errors.items}</Text> : null}
        <Button title={TEXTS.orders.addProduct} variant="secondary" onPress={() => set('items', [...values.items, newItem()])} />
      </Section>

      <Section title={TEXTS.orders.sectionExtras}>
        <View className="flex-row flex-wrap gap-2">
          {extras.map(([key, label]) => (
            <Chip
              key={key}
              label={`${label}: ${values[key] ? TEXTS.orders.yes : TEXTS.orders.no}`}
              selected={values[key]}
              onPress={() => set(key, !values[key])}
            />
          ))}
        </View>
      </Section>

      <Input
        label={TEXTS.orders.noteLabel}
        value={values.note}
        onChangeText={(text) => set('note', text)}
        multiline
        maxLength={500}
        textAlignVertical="top"
        className="min-h-[80px] py-3"
      />

      <Button title={TEXTS.common.save} loading={submitting} disabled={submitting} onPress={handleSubmit} />
    </View>
  );
}
