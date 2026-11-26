import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { monthKey } from '@/lib/months';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type {
  CommissionTier,
  CurrencyCode,
  Database,
  Employee,
  PaymentMethod,
  PayrollRow,
  SalaryPayment,
  SalaryPaymentKind,
} from '@/types/database';

const num = (value: number | null) => (value == null ? null : Number(value));

// PostgREST numeric qiymatlarni matn qilib qaytarishi mumkin — songa o'giramiz.
function normalizeRow(row: PayrollRow): PayrollRow {
  return {
    ...row,
    fixed_salary: num(row.fixed_salary),
    sales_usd: Number(row.sales_usd),
    percent: Number(row.percent),
    next_tier_from: num(row.next_tier_from),
    next_tier_percent: num(row.next_tier_percent),
    computed: Number(row.computed),
    paid: Number(row.paid),
    remaining: Number(row.remaining),
    overpaid: Number(row.overpaid),
  };
}

// Oy bo'yicha oylik: egasiga — barcha xodimlar, sotuvchiga — faqat o'zi.
export function usePayroll(month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: queryKeys.payroll.month(key),
    queryFn: async (): Promise<PayrollRow[]> => {
      const { data, error } = await supabase.rpc('payroll', { p_month: key });
      if (error) {
        throw error;
      }
      return data.map(normalizeRow);
    },
  });
}

export type EmployeeDetail = Employee & { tiers: Array<Pick<CommissionTier, 'from_usd' | 'percent'>> };

export function useEmployee(id: string) {
  return useQuery({
    queryKey: queryKeys.payroll.employee(id),
    queryFn: async (): Promise<EmployeeDetail | null> => {
      const [employee, tiers] = await Promise.all([
        supabase.from('employees').select('*').eq('id', id).maybeSingle(),
        supabase.from('commission_tiers').select('from_usd, percent').eq('employee_id', id).order('from_usd'),
      ]);
      const failed = employee.error ?? tiers.error;
      if (failed) {
        throw failed;
      }
      if (employee.data === null) {
        return null;
      }
      return {
        ...employee.data,
        fixed_salary: num(employee.data.fixed_salary),
        tiers: (tiers.data ?? []).map((tier) => ({ from_usd: Number(tier.from_usd), percent: Number(tier.percent) })),
      };
    },
  });
}

export type SalaryPaymentItem = Pick<
  SalaryPayment,
  'id' | 'amount' | 'currency' | 'rate_uzs_per_usd' | 'payment_method' | 'kind' | 'paid_at'
>;

export function useSalaryPayments(employeeId: string, month: Date) {
  const key = monthKey(month);
  return useQuery({
    queryKey: queryKeys.payroll.payments(employeeId, key),
    queryFn: async (): Promise<SalaryPaymentItem[]> => {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('id, amount, currency, rate_uzs_per_usd, payment_method, kind, paid_at')
        .eq('employee_id', employeeId)
        .eq('month', key)
        .order('paid_at');
      if (error) {
        throw error;
      }
      return data.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        rate_uzs_per_usd: num(payment.rate_uzs_per_usd),
      }));
    },
  });
}

function useInvalidatePayroll() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.balances }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
    ]);
}

export type EmployeePayload = Database['public']['Tables']['employees']['Update'] & {
  full_name: string;
  pay_type: Employee['pay_type'];
};

type SaveEmployeeInput = {
  id?: string;
  payload: EmployeePayload;
  tiers: Array<{ from_usd: number; percent: number }>;
};

// Xodim va (foizli bo'lsa) pog'onali plan — bitta tranzaksiyada (bazadagi save_employee).
export function useSaveEmployee() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: async ({ id, payload, tiers }: SaveEmployeeInput): Promise<string> => {
      const { data, error } = await supabase.rpc('save_employee', {
        p_id: id ?? null,
        p_employee: payload,
        p_tiers: payload.pay_type === 'commission' ? tiers : [],
      });
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteEmployee() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useSetDaysWorked() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: async ({ employeeId, month, days }: { employeeId: string; month: Date; days: number }) => {
      const { error } = await supabase
        .from('payroll_days')
        .upsert({ employee_id: employeeId, month: monthKey(month), days_worked: days });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

type AddSalaryPaymentInput = {
  employeeId: string;
  month: Date;
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  rate: number | null;
  kind: SalaryPaymentKind;
  paidAt: Date;
};

export function useAddSalaryPayment() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: async (input: AddSalaryPaymentInput): Promise<void> => {
      const { error } = await supabase.rpc('add_salary_payment', {
        p_employee_id: input.employeeId,
        p_month: monthKey(input.month),
        p_amount: input.amount,
        p_currency: input.currency,
        p_payment_method: input.method,
        p_rate: input.rate,
        p_kind: input.kind,
        p_paid_at: input.paidAt.toISOString(),
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSalaryPayment() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: async (paymentId: string): Promise<void> => {
      const { error } = await supabase.rpc('delete_salary_payment', { p_payment_id: paymentId });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// Arxivlash: xodim ro'yxatda pastga tushadi, oylik tarixi saqlanadi.
export function useSetEmployeeActive() {
  const invalidate = useInvalidatePayroll();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }): Promise<void> => {
      const { error } = await supabase.from('employees').update({ active }).eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}
