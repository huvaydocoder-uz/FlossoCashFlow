import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PRODUCT_TYPE_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import type { StockItemPayload, StockItemWithBalance } from '@/hooks/useStock';
import { formatAmountInput, parseAmountInput } from '@/lib/format';
import type { ProductType, StockKind, StockUnit } from '@/types/database';

type Values = {
  kind: StockKind;
  productType: ProductType;
  name: string;
  code: string;
  priceText: string;
  unit: StockUnit;
  minText: string;
  active: boolean;
};

const DEFAULT_TYPE: ProductType = 'karniz';
const numberText = (value: number) => (value > 0 ? formatAmountInput(String(value).replace('.', ',')) : '');

export function emptyStockValues(kind: StockKind = 'product'): Values {
  return {
    kind,
    productType: DEFAULT_TYPE,
    name: '',
    code: '',
    priceText: '',
    unit: kind === 'product' ? 'metr' : 'kg',
    minText: '',
    active: true,
  };
}

export function toStockValues(item: StockItemWithBalance): Values {
  return {
    kind: item.kind,
    productType: item.product_type ?? DEFAULT_TYPE,
    name: item.name,
    code: item.code ?? '',
    priceText: item.price === null ? '' : numberText(item.price),
    unit: item.unit,
    minText: numberText(item.min_qty),
    active: item.active,
  };
}

type Props = {
  initial: Values;
  isNew: boolean;
  isSystem: boolean;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (payload: StockItemPayload) => void;
};

const PRODUCT_UNITS = [
  { value: 'metr', label: TEXTS.stock.unitMetr },
  { value: 'dona', label: TEXTS.stock.unitPiece },
] as const;
const MATERIAL_UNITS = [
  { value: 'kg', label: TEXTS.stock.unitKg },
  { value: 'dona', label: TEXTS.stock.unitPiece },
  { value: 'metr', label: TEXTS.stock.unitMetr },
] as const;

// Ombor pozitsiyasi: mahsulot (turi, kodi, nomi, narxi, metr/dona) yoki xomashyo (nomi, o'lchovi), minimal qoldiq.
export function StockItemForm({ initial, isNew, isSystem, submitting, submitError, onSubmit }: Props) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();
  const [priceError, setPriceError] = useState<string>();
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError(undefined);
    setPriceError(undefined);
  };

  const submit = () => {
    const name = values.name.trim();
    if (name.length === 0) {
      setError(TEXTS.stock.nameRequired);
      return;
    }
    const price = values.priceText.trim() === '' ? null : parseAmountInput(values.priceText);
    if (values.priceText.trim() !== '' && price === null) {
      setPriceError(TEXTS.validation.amountInvalid);
      return;
    }
    const code = values.code.trim().toUpperCase();
    const product = values.kind === 'product';
    onSubmit({
      kind: values.kind,
      product_type: product ? values.productType : null,
      name,
      code: code.length > 0 ? code : null,
      price,
      unit: values.unit,
      min_qty: parseAmountInput(values.minText) ?? 0,
      active: values.active,
    });
  };

  const units = values.kind === 'product' ? PRODUCT_UNITS : MATERIAL_UNITS;

  return (
    <View className="gap-4">
      {submitError !== null ? <FormMessage message={submitError} /> : null}
      {isNew ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">{TEXTS.stock.kindLabel}</Text>
          <SegmentedControl
            options={[
              { value: 'product', label: TEXTS.stock.kindProduct },
              { value: 'material', label: TEXTS.stock.kindMaterial },
            ]}
            value={values.kind}
            onChange={(kind) => {
              set('kind', kind);
              set('unit', kind === 'product' ? 'metr' : 'kg');
            }}
          />
        </View>
      ) : null}
      {values.kind === 'product' ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">{TEXTS.stock.productTypeLabel}</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRODUCT_TYPE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={values.productType === option.value}
                onPress={() => {
                  set('productType', option.value);
                  // Igrushkalar donalab, qolganlari metrlab sotiladi.
                  set('unit', option.value.endsWith('igrushka') ? 'dona' : 'metr');
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Input
        label={TEXTS.stock.nameLabel}
        placeholder={TEXTS.stock.namePlaceholder}
        value={values.name}
        onChangeText={(text) => set('name', text)}
        error={error}
        maxLength={100}
        editable={!isSystem}
      />
      <Input
        label={TEXTS.stock.codeLabel}
        placeholder={TEXTS.stock.codePlaceholder}
        value={values.code}
        onChangeText={(text) => set('code', text.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={30}
      />
      <Input
        label={TEXTS.stock.priceLabel}
        placeholder="0"
        value={values.priceText}
        onChangeText={(text) => set('priceText', formatAmountInput(text))}
        error={priceError}
        keyboardType="decimal-pad"
      />
      {!isSystem ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">{TEXTS.stock.unitLabel}</Text>
          <SegmentedControl options={units} value={values.unit} onChange={(unit) => set('unit', unit)} />
        </View>
      ) : null}
      <Input
        label={TEXTS.stock.minLabel}
        placeholder="0"
        value={values.minText}
        onChangeText={(text) => set('minText', formatAmountInput(text))}
        keyboardType="decimal-pad"
      />
      {!isNew ? (
        <View className="flex-row">
          <Chip label={TEXTS.stock.activeLabel} selected={values.active} onPress={() => set('active', !values.active)} />
        </View>
      ) : null}
      <Button title={TEXTS.common.save} loading={submitting} onPress={submit} />
    </View>
  );
}
