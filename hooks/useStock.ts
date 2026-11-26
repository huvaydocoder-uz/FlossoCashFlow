import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { SalesReportRow, StockDirection, StockItem, StockMovement, StockReason, TopProductRow } from '@/types/database';

export type StockItemWithBalance = StockItem & { quantity: number | null };

// Kodi borlar kod bo'yicha (FIK, FIN, FKR, ...), qolganlari nomi bo'yicha.
function compareStockItems(a: StockItem, b: StockItem): number {
  if (a.kind !== b.kind) {
    return a.kind === 'product' ? -1 : 1;
  }
  if (a.code !== null && b.code !== null) {
    return a.code.localeCompare(b.code);
  }
  if (a.code !== null || b.code !== null) {
    return a.code !== null ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

// Katalog (butun jamoaga) + qoldiq (faqat egasiga; sotuvchida null).
export function useStockItems() {
  return useQuery({
    queryKey: queryKeys.stock.all,
    queryFn: async (): Promise<StockItemWithBalance[]> => {
      const [items, balances] = await Promise.all([
        supabase.from('stock_items').select('*').order('kind').order('name'),
        supabase.from('stock_balances').select('stock_item_id, quantity'),
      ]);
      const failed = items.error ?? balances.error;
      if (failed) {
        throw failed;
      }
      const byId = new Map((balances.data ?? []).map((row) => [row.stock_item_id, Number(row.quantity)]));
      return (items.data ?? [])
        .map((item) => ({
          ...item,
          min_qty: Number(item.min_qty),
          price: item.price === null ? null : Number(item.price),
          quantity: byId.get(item.id) ?? null,
        }))
        .sort(compareStockItems);
    },
  });
}

export type StockMovementItem = Pick<
  StockMovement,
  'id' | 'direction' | 'quantity' | 'reason' | 'order_id' | 'note' | 'moved_at'
> & { order: { number: number } | null };

export function useStockMovements(itemId: string) {
  return useQuery({
    queryKey: queryKeys.stock.item(itemId),
    queryFn: async (): Promise<StockMovementItem[]> => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, direction, quantity, reason, order_id, note, moved_at, order:orders(number)')
        .eq('stock_item_id', itemId)
        .order('moved_at', { ascending: false })
        .limit(200);
      if (error) {
        throw error;
      }
      return data.map((row) => ({ ...row, quantity: Number(row.quantity) }));
    },
  });
}

// Doimiy xomashyo (qum, penoplast blok, zagustitel K-29, teksanol, dots) va Flosso katalogi —
// bo'lmasa yaratiladi, keyin katalog yangilanadi.
export function useEnsureStockDefaults(enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.stockDefaults,
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { error } = await supabase.rpc('ensure_stock_defaults');
      if (error) {
        throw error;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
      return true;
    },
  });
}

function useInvalidateStock() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all }),
    ]);
}

export type StockItemPayload = {
  kind: StockItem['kind'];
  product_type: StockItem['product_type'];
  name: string;
  code: string | null;
  price: number | null;
  unit: StockItem['unit'];
  min_qty: number;
  active: boolean;
};

export function useSaveStockItem() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: StockItemPayload }): Promise<string> => {
      if (id === undefined) {
        const { data, error } = await supabase.from('stock_items').insert(payload).select('id').single();
        if (error) {
          throw error;
        }
        return data.id;
      }
      const { error } = await supabase.from('stock_items').update(payload).eq('id', id);
      if (error) {
        throw error;
      }
      return id;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteStockItem() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('stock_items').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

type MovementInput = {
  itemId: string;
  direction: StockDirection;
  quantity: number;
  reason: Exclude<StockReason, 'order'>;
  note: string | null;
  movedAt: Date;
};

export function useAddMovement() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: async (input: MovementInput): Promise<void> => {
      const { error } = await supabase.from('stock_movements').insert({
        stock_item_id: input.itemId,
        direction: input.direction,
        quantity: input.quantity,
        reason: input.reason,
        note: input.note,
        moved_at: input.movedAt.toISOString(),
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteMovement() {
  const invalidate = useInvalidateStock();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('stock_movements').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// Sotuv hisoboti (faqat egasiga).
export function useSalesReport(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.sales.report(from, to),
    queryFn: async (): Promise<{ rows: SalesReportRow[]; top: TopProductRow[] }> => {
      const [report, top] = await Promise.all([
        supabase.rpc('sales_report', { p_from: from, p_to: to }),
        supabase.rpc('top_products', { p_from: from, p_to: to }),
      ]);
      const failed = report.error ?? top.error;
      if (failed) {
        throw failed;
      }
      const n = (value: number) => Number(value);
      return {
        rows: (report.data ?? []).map((row) => ({
          ...row,
          agreed_uzs: n(row.agreed_uzs),
          agreed_usd: n(row.agreed_usd),
          paid_usd: n(row.paid_usd),
          remaining_uzs: n(row.remaining_uzs),
          remaining_usd: n(row.remaining_usd),
        })),
        top: (top.data ?? []).map((row) => ({ ...row, quantity: n(row.quantity) })),
      };
    },
  });
}
