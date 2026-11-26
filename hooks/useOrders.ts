import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toDueDateString } from '@/lib/debts';
import { fetchUsdRate } from '@/lib/exchangeRate';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/types/database';
import type { AdvanceInput, OrderDetail, OrderItemInput, OrderListItem, OrderPayload } from '@/types/models';

const numberOrNull = (value: number | null) => (value === null ? null : Number(value));

// PostgREST numeric ustunlarni matn qilib qaytarishi mumkin — songa o'giramiz.
function normalize<T extends OrderListItem>(row: T): T {
  return {
    ...row,
    agreed_price: numberOrNull(row.agreed_price),
    discount: numberOrNull(row.discount),
    paid: numberOrNull(row.paid),
    remaining: numberOrNull(row.remaining),
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    sand_kg: Number(row.sand_kg),
    chemicals_kg: Number(row.chemicals_kg),
  };
}

// Biznesdagi barcha buyurtmalar (yangilari birinchi). Sotuvchiga boshqalar puli null keladi.
export function useOrders() {
  return useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: async (): Promise<OrderListItem[]> => {
      const { data, error } = await supabase.from('order_list').select('*').order('number', { ascending: false });
      if (error) {
        throw error;
      }
      return data.map(normalize);
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: async (): Promise<OrderDetail | null> => {
      const [order, items, payments] = await Promise.all([
        supabase.from('order_list').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('order_items')
          .select('id, product_type, name, quantity, stock_item_id')
          .eq('order_id', id)
          .order('created_at'),
        supabase
          .from('order_payments')
          .select('id, amount, currency, payment_method, rate_uzs_per_usd, amount_usd, is_advance, paid_at')
          .eq('order_id', id)
          .order('paid_at'),
      ]);
      const failed = order.error ?? items.error ?? payments.error;
      if (failed) {
        throw failed;
      }
      if (order.data === null) {
        return null;
      }
      return {
        ...normalize(order.data),
        items: items.data ?? [],
        payments: (payments.data ?? []).map((payment) => ({
          ...payment,
          amount: Number(payment.amount),
          rate_uzs_per_usd: Number(payment.rate_uzs_per_usd),
          amount_usd: Number(payment.amount_usd),
        })),
      };
    },
  });
}

// Markaziy bank kursi (kun bo'yicha keshlanadi). null — olinmadi, qo'lda kiritiladi.
export function useUsdRate(date: Date) {
  const day = toDueDateString(date);
  return useQuery({
    queryKey: queryKeys.usdRate(day),
    queryFn: () => fetchUsdRate(date),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
}

function useInvalidateOrders() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.balances }),
      // Buyurtma to'lovi sotuvchining foizli oyligiga ta'sir qiladi.
      queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all }),
      // Yetkazilgan buyurtma ombordan ayiriladi.
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all }),
    ]);
}

// Buyurtma yaratildi, lekin mahsulotlar yoki avans yozilmadi — qayta "Saqlash" ikkinchi buyurtma
// yaratmasligi uchun ekran shu buyurtmaga o'tadi.
export class OrderPartiallySavedError extends Error {
  constructor(
    readonly orderId: string,
    readonly cause: unknown,
  ) {
    super('order saved, follow-up step failed');
  }
}

type SaveOrderInput = {
  id?: string;
  payload: OrderPayload;
  items: OrderItemInput[];
  advance?: AdvanceInput | null;
};

// Buyurtma va mahsulot qatorlari; yangi buyurtmada avans — birinchi to'lov sifatida.
export function useSaveOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: async ({ id, payload, items, advance }: SaveOrderInput): Promise<string> => {
      let orderId = id;
      if (orderId === undefined) {
        const { data, error } = await supabase.from('orders').insert(payload).select('id').single();
        if (error) {
          throw error;
        }
        orderId = data.id;
        try {
          await saveItemsAndAdvance(data.id, items, advance);
        } catch (error) {
          throw new OrderPartiallySavedError(data.id, error);
        }
        return data.id;
      } else {
        const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
        if (error) {
          throw error;
        }
        const removed = await supabase.from('order_items').delete().eq('order_id', orderId);
        if (removed.error) {
          throw removed.error;
        }
      }
      await saveItemsAndAdvance(orderId, items, null);
      return orderId;
    },
    // Xato bo'lsa ham ro'yxat yangilanadi (buyurtma qisman saqlangan bo'lishi mumkin).
    onSettled: invalidate,
  });
}

async function saveItemsAndAdvance(orderId: string, items: OrderItemInput[], advance: AdvanceInput | null | undefined) {
  if (items.length > 0) {
    const { error } = await supabase.from('order_items').insert(items.map((item) => ({ ...item, order_id: orderId })));
    if (error) {
      throw error;
    }
  }
  if (advance !== undefined && advance !== null && advance.amount > 0) {
    const { error } = await supabase.rpc('add_order_payment', {
      p_order_id: orderId,
      p_amount: advance.amount,
      p_currency: advance.currency,
      p_payment_method: advance.method,
      p_rate: advance.rate,
      p_is_advance: true,
    });
    if (error) {
      throw error;
    }
  }
}

export function useSetOrderStatus() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }): Promise<void> => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteOrder() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

type AddOrderPaymentInput = AdvanceInput & { orderId: string; paidAt: Date; isAdvance: boolean };

export function useAddOrderPayment() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: async ({ orderId, amount, currency, method, rate, paidAt, isAdvance }: AddOrderPaymentInput) => {
      const { error } = await supabase.rpc('add_order_payment', {
        p_order_id: orderId,
        p_amount: amount,
        p_currency: currency,
        p_payment_method: method,
        p_rate: rate,
        p_is_advance: isAdvance,
        p_paid_at: paidAt.toISOString(),
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteOrderPayment() {
  const invalidate = useInvalidateOrders();
  return useMutation({
    mutationFn: async (paymentId: string): Promise<void> => {
      const { error } = await supabase.rpc('delete_order_payment', { p_payment_id: paymentId });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}
