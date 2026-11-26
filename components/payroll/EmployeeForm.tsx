import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AmountField } from '@/components/transaction/AmountField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { useTeamMembers } from '@/hooks/useMembership';
import type { EmployeeDetail, EmployeePayload } from '@/hooks/usePayroll';
import { formatAmountInput, parseAmountInput } from '@/lib/format';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { validatePhone } from '@/lib/validation';
import type { CurrencyCode, EmployeePayType } from '@/types/database';

type TierValues = { key: string; from: string; percent: string };

export type EmployeeFormValues = {
  fullName: string;
  phone: string;
  position: string;
  payType: EmployeePayType;
  salaryText: string;
  currency: CurrencyCode;
  normDays: string;
  tiers: TierValues[];
  memberUserId: string | null;
  active: boolean;
};

let tierKey = 0;
const tier = (from: string, percent: string): TierValues => ({ key: `tier-${(tierKey += 1)}`, from, percent });
const money = (value: number) => formatAmountInput(String(value).replace('.', ','));

export function createEmptyEmployeeValues(): EmployeeFormValues {
  return {
    fullName: '',
    phone: '',
    position: '',
    payType: 'fixed',
    salaryText: '',
    currency: 'UZS',
    normDays: '25',
    // Egasi aytgan namuna: 20 000 $ gacha 2%, 35 000 $ gacha 3%, undan yuqori 4%.
    tiers: [tier('0', '2'), tier(money(20000), '3'), tier(money(35000), '4')],
    memberUserId: null,
    active: true,
  };
}

export function toEmployeeValues(employee: EmployeeDetail): EmployeeFormValues {
  const base = createEmptyEmployeeValues();
  return {
    fullName: employee.full_name,
    phone: employee.phone === null ? '' : formatPhone(employee.phone),
    position: employee.position ?? '',
    payType: employee.pay_type,
    salaryText: employee.fixed_salary === null ? '' : money(employee.fixed_salary),
    currency: employee.salary_currency,
    normDays: String(employee.norm_days),
    tiers: employee.tiers.length > 0 ? employee.tiers.map((t) => tier(money(t.from_usd), String(t.percent))) : base.tiers,
    memberUserId: employee.member_user_id,
    active: employee.active,
  };
}

type Errors = Partial<Record<'name' | 'phone' | 'salary' | 'normDays' | 'tiers', string>>;

type EmployeeFormProps = {
  initial: EmployeeFormValues;
  isNew: boolean;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (input: { payload: EmployeePayload; tiers: Array<{ from_usd: number; percent: number }> }) => void;
};

export function EmployeeForm({ initial, isNew, submitting, submitError, onSubmit }: EmployeeFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const team = useTeamMembers(true);
  const sellers = (team.data ?? []).filter((member) => member.status === 'active' && member.role === 'seller');

  const set = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors({});
  };
  const setTier = (key: string, patch: Partial<TierValues>) =>
    set('tiers', values.tiers.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const handleSubmit = () => {
    const name = values.fullName.trim();
    const salary = parseAmountInput(values.salaryText);
    const normDays = Number(values.normDays);
    const tiers = values.tiers
      .map((item) => ({ from_usd: parseAmountInput(item.from), percent: Number(item.percent.replace(',', '.')) }))
      .sort((a, b) => (a.from_usd ?? 0) - (b.from_usd ?? 0));
    const tiersValid =
      tiers.length > 0 &&
      tiers.every((item) => item.from_usd !== null && Number.isFinite(item.percent) && item.percent >= 0 && item.percent <= 100) &&
      tiers[0]?.from_usd === 0 &&
      new Set(tiers.map((item) => item.from_usd)).size === tiers.length;
    const next: Errors = {
      name: name.length === 0 ? TEXTS.payroll.nameRequired : undefined,
      phone: validatePhone(values.phone),
      salary: values.payType === 'fixed' && (salary === null || salary <= 0) ? TEXTS.payroll.salaryRequired : undefined,
      normDays: values.payType === 'fixed' && !(normDays >= 1 && normDays <= 31) ? TEXTS.payroll.daysInvalid : undefined,
      tiers: values.payType === 'commission' && !tiersValid ? TEXTS.payroll.tierInvalid : undefined,
    };
    setErrors(next);
    if (Object.values(next).some((message) => message !== undefined)) {
      return;
    }
    const phone = normalizePhone(values.phone);
    const position = values.position.trim();
    onSubmit({
      payload: {
        full_name: name,
        phone,
        position: position.length > 0 ? position : null,
        pay_type: values.payType,
        fixed_salary: values.payType === 'fixed' ? salary : null,
        salary_currency: values.payType === 'fixed' ? values.currency : 'USD',
        norm_days: values.payType === 'fixed' ? normDays : 25,
        member_user_id: values.memberUserId,
        active: values.active,
      },
      tiers: values.payType === 'commission' ? tiers.map((item) => ({ from_usd: item.from_usd ?? 0, percent: item.percent })) : [],
    });
  };

  return (
    <View className="gap-4">
      {submitError !== null ? <FormMessage message={submitError} /> : null}

      <Card className="gap-4">
        <Input
          label={TEXTS.payroll.nameLabel}
          placeholder={TEXTS.payroll.namePlaceholder}
          value={values.fullName}
          onChangeText={(text) => set('fullName', text)}
          error={errors.name}
          maxLength={100}
        />
        <PhoneInput
          label={TEXTS.payroll.phoneLabel}
          value={values.phone}
          onChangeText={(text) => set('phone', text)}
          error={errors.phone}
        />
        <Input
          label={TEXTS.payroll.positionLabel}
          placeholder={TEXTS.payroll.positionPlaceholder}
          value={values.position}
          onChangeText={(text) => set('position', text)}
          maxLength={60}
        />
      </Card>

      <Card className="gap-4">
        <Text className="text-sm font-medium text-ink">{TEXTS.payroll.payTypeLabel}</Text>
        <SegmentedControl
          options={[
            { value: 'fixed', label: TEXTS.payroll.payFixed },
            { value: 'commission', label: TEXTS.payroll.payCommission },
          ]}
          value={values.payType}
          onChange={(value) => set('payType', value)}
        />

        {values.payType === 'fixed' ? (
          <View className="gap-4">
            <AmountField
              amountText={values.salaryText}
              onChangeAmount={(text) => set('salaryText', text)}
              currency={values.currency}
              onChangeCurrency={(currency) => set('currency', currency)}
              error={errors.salary}
            />
            <Input
              label={TEXTS.payroll.normDaysLabel}
              value={values.normDays}
              onChangeText={(text) => set('normDays', text.replace(/\D/g, '').slice(0, 2))}
              error={errors.normDays}
              keyboardType="number-pad"
            />
            <Text className="text-sm text-ink-muted">{TEXTS.payroll.fixedHint}</Text>
          </View>
        ) : (
          <View className="gap-3">
            <Text className="text-base font-semibold text-ink">{TEXTS.payroll.tiersLabel}</Text>
            {values.tiers.map((item) => (
              <View key={item.key} className="flex-row items-end gap-2">
                <View className="flex-[2]">
                  <Input
                    label={TEXTS.payroll.tierFrom}
                    value={item.from}
                    onChangeText={(text) => setTier(item.key, { from: formatAmountInput(text) })}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Input
                    label={TEXTS.payroll.tierPercent}
                    value={item.percent}
                    onChangeText={(text) => setTier(item.key, { percent: text.replace(/[^\d.,]/g, '').slice(0, 5) })}
                    keyboardType="decimal-pad"
                  />
                </View>
                {values.tiers.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={TEXTS.payroll.removeTier}
                    hitSlop={SIZES.hitSlop}
                    onPress={() => set('tiers', values.tiers.filter((other) => other.key !== item.key))}
                    className="mb-3 px-2"
                  >
                    <Text className="text-xl text-danger">×</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            {errors.tiers !== undefined ? <Text className="text-sm text-danger">{errors.tiers}</Text> : null}
            <Button title={TEXTS.payroll.addTier} variant="secondary" onPress={() => set('tiers', [...values.tiers, tier('', '')])} />
            <Text className="text-sm text-ink-muted">{TEXTS.payroll.tiersHint}</Text>
          </View>
        )}
      </Card>

      <Card className="gap-3">
        <Text className="text-sm font-medium text-ink">{TEXTS.payroll.accountLabel}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Chip label={TEXTS.payroll.noAccount} selected={values.memberUserId === null} onPress={() => set('memberUserId', null)} />
          {sellers.map((member) => (
            <Chip
              key={member.userId}
              label={member.fullName ?? TEXTS.team.noName}
              selected={values.memberUserId === member.userId}
              onPress={() => set('memberUserId', member.userId)}
            />
          ))}
        </View>
        <Text className="text-sm text-ink-muted">{TEXTS.payroll.accountHint}</Text>
        {!isNew ? (
          <Chip label={TEXTS.payroll.activeLabel} selected={values.active} onPress={() => set('active', !values.active)} />
        ) : null}
      </Card>

      <Button title={TEXTS.common.save} loading={submitting} disabled={submitting} onPress={handleSubmit} />
    </View>
  );
}
